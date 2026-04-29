const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

function computeStatus(bill) {
  if (bill.paid) return 'paid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(bill.dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today ? 'overdue' : 'pending';
}

router.get('/', async (req, res, next) => {
  try {
    const { month, year, status } = req.query;
    const now = new Date();
    const m = parseInt(month || now.getMonth() + 1);
    const y = parseInt(year || now.getFullYear());

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);

    // Auto-generate recurring bills for this month if they don't exist yet.
    // Uses a transaction to avoid race condition on concurrent requests.
    await prisma.$transaction(async (tx) => {
      const count = await tx.bill.count({
        where: { userId: req.userId, dueDate: { gte: start, lte: end } },
      });

      if (count === 0) {
        const recurrentTemplates = await tx.bill.findMany({
          where: { userId: req.userId, recurrent: true },
          orderBy: { dueDate: 'desc' },
          distinct: ['description'],
        });

        if (recurrentTemplates.length > 0) {
          const creates = recurrentTemplates.map(tpl => {
            const origDay = new Date(tpl.dueDate).getDate();
            const dueDate = new Date(y, m - 1, origDay);
            return tx.bill.create({
              data: {
                userId: req.userId,
                description: tpl.description,
                value: tpl.value,
                dueDate,
                category: tpl.category,
                responsible: tpl.responsible,
                recurrent: true,
                paid: false,
                status: computeStatus({ paid: false, dueDate }),
              },
            });
          });
          await Promise.all(creates);
        }
      }
    });

    const where = { userId: req.userId, dueDate: { gte: start, lte: end } };
    let items = await prisma.bill.findMany({ where, orderBy: { dueDate: 'asc' } });

    // Auto-update statuses
    const updates = [];
    items = items.map(bill => {
      const newStatus = computeStatus(bill);
      if (newStatus !== bill.status) {
        updates.push(prisma.bill.update({ where: { id: bill.id }, data: { status: newStatus } }));
        return { ...bill, status: newStatus };
      }
      return bill;
    });
    if (updates.length) await Promise.all(updates);

    if (status) items = items.filter(b => b.status === status);

    const totals = {
      total: items.reduce((s, b) => s + b.value, 0),
      paid: items.filter(b => b.status === 'paid').reduce((s, b) => s + b.value, 0),
      pending: items.filter(b => b.status === 'pending').reduce((s, b) => s + b.value, 0),
      overdue: items.filter(b => b.status === 'overdue').reduce((s, b) => s + b.value, 0),
    };

    res.json({ items, totals });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { description, value, dueDate, category, responsible, recurrent } = req.body;
    if (!description || value === undefined || !dueDate || !category) {
      return res.status(400).json({ error: 'Campos obrigatórios: description, value, dueDate, category' });
    }
    const bill = await prisma.bill.create({
      data: {
        userId: req.userId,
        description,
        value: parseFloat(value),
        dueDate: new Date(dueDate),
        category,
        responsible,
        recurrent: !!recurrent,
        status: 'pending',
      },
    });
    res.status(201).json({ ...bill, status: computeStatus(bill) });
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const existing = await prisma.bill.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Conta não encontrada' });

    const paid = !existing.paid;
    const bill = await prisma.bill.update({
      where: { id: req.params.id },
      data: {
        paid,
        paidAt: paid ? new Date() : null,
        status: paid ? 'paid' : computeStatus({ ...existing, paid: false }),
      },
    });
    res.json(bill);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.bill.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Conta não encontrada' });

    const { description, value, dueDate, category, responsible, recurrent } = req.body;
    const bill = await prisma.bill.update({
      where: { id: req.params.id },
      data: {
        description,
        value: value !== undefined ? parseFloat(value) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        category,
        responsible,
        recurrent: recurrent !== undefined ? !!recurrent : undefined,
      },
    });
    res.json(bill);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await prisma.bill.deleteMany({ where: { id: req.params.id, userId: req.userId } });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
