const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const m = parseInt(month || now.getMonth() + 1);
    const y = parseInt(year || now.getFullYear());

    const items = await prisma.planning.findMany({
      where: { userId: req.userId, month: m, year: y },
      orderBy: { category: 'asc' },
    });

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);
    const expenses = await prisma.expense.findMany({
      where: { userId: req.userId, date: { gte: start, lte: end } },
    });

    const realizedByCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.value;
      return acc;
    }, {});

    const synced = await Promise.all(
      items.map(async item => {
        const realized = realizedByCategory[item.category] || 0;
        if (Math.abs(realized - item.realizedValue) > 0.01) {
          return prisma.planning.update({ where: { id: item.id }, data: { realizedValue: realized } });
        }
        return item;
      })
    );

    const result = synced.map(item => ({
      ...item,
      realizedValue: realizedByCategory[item.category] || item.realizedValue,
      status: (realizedByCategory[item.category] || item.realizedValue) > item.plannedValue ? 'over' : 'ok',
      overrunPercent: item.plannedValue > 0
        ? Math.round(((realizedByCategory[item.category] || item.realizedValue) / item.plannedValue) * 100)
        : 0,
    }));

    const totalPlanned = result.reduce((s, p) => s + p.plannedValue, 0);
    const totalRealized = result.reduce((s, p) => s + p.realizedValue, 0);

    res.json({ items: result, totalPlanned, totalRealized });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { month, year, category, plannedValue } = req.body;
    if (!month || !year || !category || plannedValue === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios: month, year, category, plannedValue' });
    }
    const item = await prisma.planning.upsert({
      where: { userId_month_year_category: { userId: req.userId, month: parseInt(month), year: parseInt(year), category } },
      update: { plannedValue: parseFloat(plannedValue) },
      create: {
        userId: req.userId,
        month: parseInt(month),
        year: parseInt(year),
        category,
        plannedValue: parseFloat(plannedValue),
      },
    });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.planning.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
