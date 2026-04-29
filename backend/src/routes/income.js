const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { month, year, category, person } = req.query;
    const where = { userId: req.userId };

    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
    }
    if (category) where.category = category;
    if (person) where.person = person;

    const items = await prisma.income.findMany({ where, orderBy: { date: 'desc' } });
    const total = items.reduce((s, i) => s + i.value, 0);
    res.json({ items, total });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { date, description, category, value, type, person } = req.body;
    if (!date || !description || !category || value === undefined || !type) {
      return res.status(400).json({ error: 'Campos obrigatórios: date, description, category, value, type' });
    }
    const item = await prisma.income.create({
      data: {
        userId: req.userId,
        date: new Date(date),
        description,
        category,
        value: parseFloat(value),
        type,
        person,
      },
    });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.income.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Receita não encontrada' });

    const { date, description, category, value, type, person } = req.body;
    const item = await prisma.income.update({
      where: { id: req.params.id },
      data: {
        date: date ? new Date(date) : undefined,
        description,
        category,
        value: value !== undefined ? parseFloat(value) : undefined,
        type,
        person,
      },
    });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.income.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
