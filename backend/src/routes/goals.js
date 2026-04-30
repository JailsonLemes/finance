const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { createGoalSchema, contributeSchema, validate } = require('../lib/schemas');

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const items = await prisma.goal.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(
      items.map((g) => ({
        ...g,
        progressPercent:
          Number(g.targetValue) > 0
            ? Math.min(100, Math.round((Number(g.currentValue) / Number(g.targetValue)) * 100))
            : 0,
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = validate(req, res, createGoalSchema);
    if (!data) return;

    const item = await prisma.goal.create({
      data: {
        userId:       req.userId,
        title:        data.title,
        description:  data.description ?? null,
        targetValue:  data.targetValue,
        currentValue: data.currentValue ?? 0,
        targetDate:   data.targetDate ? new Date(data.targetDate) : null,
        category:     data.category,
        color:        data.color ?? '#6366f1',
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

    const data = validate(req, res, createGoalSchema.partial());
    if (!data) return;

    const item = await prisma.goal.update({
      where: { id: req.params.id },
      data: {
        ...(data.title        !== undefined && { title: data.title }),
        ...(data.description  !== undefined && { description: data.description }),
        ...(data.targetValue  !== undefined && { targetValue: data.targetValue }),
        ...(data.currentValue !== undefined && { currentValue: data.currentValue }),
        ...(data.targetDate   !== undefined && { targetDate: data.targetDate ? new Date(data.targetDate) : null }),
        ...(data.category     !== undefined && { category: data.category }),
        ...(data.color        !== undefined && { color: data.color }),
      },
    });
    res.json(item);
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /:id/contribute
 * Incremento atômico via $transaction — elimina race condition (lost update).
 * Antes: read → calcular → write em duas operações separadas.
 * Agora: leitura e escrita dentro da mesma transaction com increment atômico.
 */
router.patch('/:id/contribute', async (req, res, next) => {
  try {
    const data = validate(req, res, contributeSchema);
    if (!data) return;

    const updated = await prisma.$transaction(async (tx) => {
      const goal = await tx.goal.findFirst({
        where: { id: req.params.id, userId: req.userId },
      });
      if (!goal) {
        const err = new Error('Meta não encontrada');
        err.status = 404;
        throw err;
      }

      const remaining = Number(goal.targetValue) - Number(goal.currentValue);
      if (remaining <= 0) {
        const err = new Error('Meta já atingida');
        err.status = 400;
        throw err;
      }

      // Limita ao valor restante para não ultrapassar o target
      const increment = Math.min(data.amount, remaining);

      return tx.goal.update({
        where: { id: req.params.id },
        data:  { currentValue: { increment } },
      });
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
