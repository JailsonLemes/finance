const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.investment.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });

    const totalInvested = items.reduce((s, i) => s + parseFloat(i.investedValue), 0);
    const totalCurrent = items.reduce((s, i) => s + parseFloat(i.currentValue), 0);
    const totalReturn = totalCurrent - totalInvested;
    const returnPercent = totalInvested > 0 ? ((totalReturn / totalInvested) * 100).toFixed(2) : 0;

    const byType = items.reduce((acc, i) => {
      acc[i.type] = (acc[i.type] || 0) + parseFloat(i.currentValue);
      return acc;
    }, {});

    res.json({ items, totalInvested, totalCurrent, totalReturn, returnPercent, byType });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { type, description, investedValue, currentValue, profitability, date } = req.body;
    if (!type || !description || investedValue === undefined || !date) {
      return res.status(400).json({ error: 'Campos obrigatórios: type, description, investedValue, date' });
    }
    const item = await prisma.investment.create({
      data: {
        userId: req.userId,
        type,
        description,
        investedValue: parseFloat(investedValue),
        currentValue: parseFloat(currentValue || investedValue),
        profitability: parseFloat(profitability || 0),
        date: new Date(date),
      },
    });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.investment.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Investimento não encontrado' });

    const { type, description, investedValue, currentValue, profitability, date } = req.body;
    const item = await prisma.investment.update({
      where: { id: req.params.id },
      data: {
        type,
        description,
        investedValue: investedValue ? parseFloat(investedValue) : undefined,
        currentValue: currentValue ? parseFloat(currentValue) : undefined,
        profitability: profitability !== undefined ? parseFloat(profitability) : undefined,
        date: date ? new Date(date) : undefined,
      },
    });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.delete('/by-month', async (req, res, next) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'month e year são obrigatórios' });
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month, 0, 23, 59, 59);
    const { count } = await prisma.investment.deleteMany({
      where: { userId: req.userId, date: { gte: start, lte: end } },
    });
    res.json({ deleted: count });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.investment.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
