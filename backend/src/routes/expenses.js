const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { month, year, category, person, paymentMethod } = req.query;
    const where = { userId: req.userId };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
    }
    if (category) where.category = category;
    if (person) where.person = person;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    const items = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { card: { select: { name: true, color: true } } },
    });

    const total = items.reduce((s, e) => s + e.value, 0);
    const byCategory = items.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.value;
      return acc;
    }, {});

    res.json({ items, total, byCategory });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { date, description, category, subcategory, value, person, paymentMethod, dueDate, cardId } = req.body;
    if (!date || !description || !category || value === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios: date, description, category, value' });
    }
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
        cardId: cardId || null,
      },
    });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.expense.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Despesa não encontrada' });

    const { date, description, category, subcategory, value, person, paymentMethod, dueDate, cardId } = req.body;
    const item = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        date: date ? new Date(date) : undefined,
        description,
        category,
        subcategory,
        value: value !== undefined ? parseFloat(value) : undefined,
        person,
        paymentMethod,
        dueDate: dueDate ? new Date(dueDate) : null,
        cardId: cardId || null,
      },
    });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.expense.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
