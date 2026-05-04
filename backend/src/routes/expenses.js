const router  = require('express').Router();
const { createId } = require('@paralleldrive/cuid2');
const prisma  = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { createExpenseSchema, validate } = require('../lib/schemas');

router.use(authMiddleware);

// ─── GET /expenses ────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { month, year, category, person, paymentMethod } = req.query;
    const where = { userId: req.userId };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end   = new Date(year, month, 0, 23, 59, 59);
      where.date  = { gte: start, lte: end };
    }
    if (category)      where.category      = category;
    if (person)        where.person        = person;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    const items = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { card: { select: { name: true, color: true } } },
    });

    const total      = items.reduce((s, e) => s + parseFloat(e.value), 0);
    const byCategory = items.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + parseFloat(e.value);
      return acc;
    }, {});

    res.json({ items, total, byCategory });
  } catch (e) { next(e); }
});

// ─── POST /expenses ───────────────────────────────────────────────────────────
// Quando installmentTotal > 1, cria N registros (um por mês) linkados pelo groupId.
router.post('/', async (req, res, next) => {
  try {
    const body = validate(req, res, createExpenseSchema);
    if (!body) return;

    const {
      date, description, category, subcategory, value,
      person, paymentMethod, dueDate, cardId,
      installmentCurrent, installmentTotal,
    } = body;

    const total = installmentTotal ?? 1;
    const start = installmentCurrent ?? 1;

    if (total > 1 && start > total) {
      return res.status(400).json({ error: 'Parcela atual não pode ser maior que o total' });
    }

    // Despesa simples (sem parcelamento)
    if (total <= 1) {
      const item = await prisma.expense.create({
        data: {
          userId: req.userId,
          date: new Date(date),
          description,
          category,
          subcategory,
          value: parseFloat(value),
          person,
          paymentMethod,
          dueDate: dueDate ? new Date(dueDate) : null,
          cardId:  cardId  || null,
        },
      });
      return res.status(201).json(item);
    }

    // Parcelado: cria N registros a partir da parcela `start`
    const groupId  = createId();
    const baseDate = new Date(date);
    const records  = [];

    for (let i = start; i <= total; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + (i - start), 1);
      records.push({
        userId:              req.userId,
        date:                d,
        description,
        category,
        subcategory:         subcategory || null,
        value:               parseFloat(value),
        person,
        paymentMethod,
        dueDate:             dueDate ? new Date(dueDate) : null,
        cardId:              cardId  || null,
        installmentCurrent:  i,
        installmentTotal:    total,
        installmentGroupId:  groupId,
      });
    }

    await prisma.expense.createMany({ data: records });

    // Retorna a primeira parcela criada para o cliente
    const first = await prisma.expense.findFirst({
      where: { installmentGroupId: groupId, installmentCurrent: start },
    });
    return res.status(201).json(first);
  } catch (e) { next(e); }
});

// ─── PUT /expenses/:id ────────────────────────────────────────────────────────
// ?mode=single (padrão) | remaining | all
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' });

    const {
      date, description, category, subcategory, value,
      person, paymentMethod, dueDate, cardId,
      installmentCurrent, installmentTotal,
    } = req.body;

    const mode = req.query.mode || 'single';
    const data = {
      date:          date        ? new Date(date) : undefined,
      description,
      category,
      subcategory,
      value:         value !== undefined ? parseFloat(value) : undefined,
      person,
      paymentMethod,
      dueDate:       dueDate ? new Date(dueDate) : null,
      cardId:        cardId  || null,
      installmentCurrent: installmentCurrent ? parseInt(installmentCurrent) : undefined,
      installmentTotal:   installmentTotal   ? parseInt(installmentTotal)   : undefined,
    };

    if (mode !== 'single' && existing.installmentGroupId) {
      const where = { installmentGroupId: existing.installmentGroupId, userId: req.userId };
      if (mode === 'remaining') where.installmentCurrent = { gte: existing.installmentCurrent };

      // Para "remaining/all", preserva o número de parcela de cada registro
      const { installmentCurrent: _ic, ...sharedData } = data;
      await prisma.expense.updateMany({ where, data: sharedData });
    } else {
      await prisma.expense.update({ where: { id: req.params.id }, data });
    }

    const updated = await prisma.expense.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (e) { next(e); }
});

// ─── DELETE /expenses/:id ─────────────────────────────────────────────────────
// ?mode=single (padrão) | remaining | all
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' });

    const mode = req.query.mode || 'single';

    if (mode !== 'single' && existing.installmentGroupId) {
      const where = { installmentGroupId: existing.installmentGroupId, userId: req.userId };
      if (mode === 'remaining') where.installmentCurrent = { gte: existing.installmentCurrent };
      await prisma.expense.deleteMany({ where });
    } else {
      await prisma.expense.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    }

    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
