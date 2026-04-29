const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.goal.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items.map(g => ({
      ...g,
      progressPercent: g.targetValue > 0 ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : 0,
    })));
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description, targetValue, currentValue, targetDate, category, color } = req.body;
    if (!title || targetValue === undefined) {
      return res.status(400).json({ error: 'Campos obrigatórios: title, targetValue' });
    }
    const item = await prisma.goal.create({
      data: {
        userId: req.userId,
        title,
        description,
        targetValue: parseFloat(targetValue),
        currentValue: parseFloat(currentValue || 0),
        targetDate: targetDate ? new Date(targetDate) : null,
        category,
        color: color || '#6366f1',
      },
    });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.goal.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Meta não encontrada' });

    const { title, description, targetValue, currentValue, targetDate, category, color } = req.body;
    const item = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        targetValue: targetValue ? parseFloat(targetValue) : undefined,
        currentValue: currentValue !== undefined ? parseFloat(currentValue) : undefined,
        targetDate: targetDate ? new Date(targetDate) : null,
        category,
        color,
      },
    });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/contribute', async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (amount === undefined) return res.status(400).json({ error: 'Campo obrigatório: amount' });

    const goal = await prisma.goal.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!goal) return res.status(404).json({ error: 'Meta não encontrada' });

    const updated = await prisma.goal.update({
      where: { id: req.params.id },
      data: { currentValue: Math.min(goal.targetValue, goal.currentValue + parseFloat(amount)) },
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.goal.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
