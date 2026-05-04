const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const cards = await prisma.card.findMany({
      where: { userId: req.userId },
      include: {
        expenses: { orderBy: { date: 'desc' }, take: 50 },
        installments: { orderBy: { date: 'desc' } },
      },
    });

    const result = cards.map(card => {
      const now = new Date();
      const closing = new Date(now.getFullYear(), now.getMonth(), card.closingDay);
      const invoiceStart = closing < now
        ? new Date(now.getFullYear(), now.getMonth(), card.closingDay + 1)
        : new Date(now.getFullYear(), now.getMonth() - 1, card.closingDay + 1);
      const invoiceEnd = closing < now
        ? new Date(now.getFullYear(), now.getMonth() + 1, card.closingDay)
        : new Date(now.getFullYear(), now.getMonth(), card.closingDay);

      const currentExpenses = card.expenses.filter(e => {
        const d = new Date(e.date);
        return d >= invoiceStart && d <= invoiceEnd;
      });
      const currentInstallments = card.installments.filter(i => {
        const d = new Date(i.date);
        return d >= invoiceStart && d <= invoiceEnd;
      });

      const invoiceTotal =
        currentExpenses.reduce((s, e) => s + parseFloat(e.value), 0) +
        currentInstallments.reduce((s, i) => s + parseFloat(i.installmentValue), 0);

      return {
        ...card,
        invoiceTotal,
        usedLimit: invoiceTotal,
        availableLimit: card.cardLimit - invoiceTotal,
        currentExpenses,
        currentInstallments,
      };
    });

    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, cardLimit, closingDay, dueDay, color } = req.body;
    if (!name || cardLimit === undefined || !closingDay || !dueDay) {
      return res.status(400).json({ error: 'Campos obrigatórios: name, cardLimit, closingDay, dueDay' });
    }
    const card = await prisma.card.create({
      data: {
        userId: req.userId,
        name,
        cardLimit: parseFloat(cardLimit),
        closingDay: parseInt(closingDay),
        dueDay: parseInt(dueDay),
        color: color || '#6366f1',
      },
    });
    res.status(201).json(card);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.card.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Cartão não encontrado' });

    const { name, cardLimit, closingDay, dueDay, color } = req.body;
    const card = await prisma.card.update({
      where: { id: req.params.id },
      data: {
        name,
        cardLimit: cardLimit ? parseFloat(cardLimit) : undefined,
        closingDay: closingDay ? parseInt(closingDay) : undefined,
        dueDay: dueDay ? parseInt(dueDay) : undefined,
        color,
      },
    });
    res.json(card);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.card.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

// #4 fix: verify card ownership before creating installment
router.post('/:id/installments', async (req, res, next) => {
  try {
    const card = await prisma.card.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!card) return res.status(404).json({ error: 'Cartão não encontrado' });

    const { description, totalValue, totalInstallments, date } = req.body;
    if (!description || totalValue === undefined || !totalInstallments || !date) {
      return res.status(400).json({ error: 'Campos obrigatórios: description, totalValue, totalInstallments, date' });
    }
    const installmentValue = parseFloat(totalValue) / parseInt(totalInstallments);
    const installment = await prisma.installment.create({
      data: {
        cardId: req.params.id,
        description,
        totalValue: parseFloat(totalValue),
        installmentValue,
        totalInstallments: parseInt(totalInstallments),
        currentInstallment: 1,
        date: new Date(date),
      },
    });
    res.status(201).json(installment);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
