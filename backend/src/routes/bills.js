const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { createBillSchema, validate } = require('../lib/schemas');

router.use(authMiddleware);

function computeStatus(bill) {
  if (bill.paid) return 'paid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(bill.dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today ? 'overdue' : 'pending';
}

/**
 * Calcula a data de vencimento de uma conta recorrente para o mês/ano alvo,
 * respeitando o último dia do mês (ex: dia 31 em fevereiro → dia 28/29).
 */
function recurringDueDate(originalDueDate, targetYear, targetMonth) {
  const origDay = new Date(originalDueDate).getDate();
  const lastDayOfMonth = new Date(targetYear, targetMonth, 0).getDate(); // dia 0 = último dia do mês anterior
  const safeDay = Math.min(origDay, lastDayOfMonth);
  return new Date(targetYear, targetMonth - 1, safeDay);
}

router.get('/', async (req, res, next) => {
  try {
    const { month, year, status } = req.query;
    const now = new Date();
    const m = parseInt(month || now.getMonth() + 1, 10);
    const y = parseInt(year || now.getFullYear(), 10);

    if (isNaN(m) || isNaN(y) || m < 1 || m > 12) {
      return res.status(400).json({ error: 'month/year inválidos' });
    }

    const start = new Date(y, m - 1, 1);
    const end   = new Date(y, m, 0, 23, 59, 59);

    // Gera contas recorrentes do mês se ainda não existem
    await prisma.$transaction(async (tx) => {
      const count = await tx.bill.count({
        where: { userId: req.userId, dueDate: { gte: start, lte: end } },
      });

      if (count === 0) {
        const templates = await tx.bill.findMany({
          where: { userId: req.userId, recurrent: true },
          orderBy: { dueDate: 'desc' },
          distinct: ['description'],
        });

        if (templates.length > 0) {
          await Promise.all(
            templates.map((tpl) => {
              // FIX: usa recurringDueDate em vez de new Date(y, m-1, origDay)
              const dueDate = recurringDueDate(tpl.dueDate, y, m);
              return tx.bill.create({
                data: {
                  userId:      req.userId,
                  description: tpl.description,
                  value:       tpl.value,
                  dueDate,
                  category:    tpl.category,
                  responsible: tpl.responsible,
                  recurrent:   true,
                  paid:        false,
                  status:      computeStatus({ paid: false, dueDate }),
                },
              });
            })
          );
        }
      }
    });

    const where = { userId: req.userId, dueDate: { gte: start, lte: end } };
    let items = await prisma.bill.findMany({ where, orderBy: { dueDate: 'asc' } });

    // Atualiza status desatualizados automaticamente
    const updates = [];
    items = items.map((bill) => {
      const newStatus = computeStatus(bill);
      if (newStatus !== bill.status) {
        updates.push(prisma.bill.update({ where: { id: bill.id }, data: { status: newStatus } }));
        return { ...bill, status: newStatus };
      }
      return bill;
    });
    if (updates.length) await Promise.all(updates);

    if (status) items = items.filter((b) => b.status === status);

    const totals = {
      total:   items.reduce((s, b) => s + Number(b.value), 0),
      paid:    items.filter((b) => b.status === 'paid').reduce((s, b) => s + Number(b.value), 0),
      pending: items.filter((b) => b.status === 'pending').reduce((s, b) => s + Number(b.value), 0),
      overdue: items.filter((b) => b.status === 'overdue').reduce((s, b) => s + Number(b.value), 0),
    };

    res.json({ items, totals });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const data = validate(req, res, createBillSchema);
    if (!data) return;

    const bill = await prisma.bill.create({
      data: {
        userId:      req.userId,
        description: data.description,
        value:       data.value,
        dueDate:     new Date(data.dueDate),
        category:    data.category,
        responsible: data.responsible,
        recurrent:   data.recurrent ?? false,
        paid:        false,
        status:      'pending',
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

    const data = validate(req, res, createBillSchema.partial());
    if (!data) return;

    const bill = await prisma.bill.update({
      where: { id: req.params.id },
      data: {
        ...(data.description !== undefined && { description: data.description }),
        ...(data.value       !== undefined && { value: data.value }),
        ...(data.dueDate     !== undefined && { dueDate: new Date(data.dueDate) }),
        ...(data.category    !== undefined && { category: data.category }),
        ...(data.responsible !== undefined && { responsible: data.responsible }),
        ...(data.recurrent   !== undefined && { recurrent: data.recurrent }),
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
