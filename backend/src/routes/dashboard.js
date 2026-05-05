const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { startOfMonth, endOfMonth, subMonths, format } = require('date-fns');

const toNum = v => Number(v);

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now     = new Date();
    const refDate = new Date(year || now.getFullYear(), (month ? month - 1 : now.getMonth()), 1);
    const start   = startOfMonth(refDate);
    const end     = endOfMonth(refDate);
    const userId  = req.userId;

    const sixMonthsAgo = startOfMonth(subMonths(refDate, 5));

    const [
      incomes, expenses, bills, investments, goals,
      allHistInc, allHistExp, allHistBills,
    ] = await Promise.all([
      prisma.income.findMany({ where: { userId, date: { gte: start, lte: end } } }),
      prisma.expense.findMany({ where: { userId, date: { gte: start, lte: end } } }),
      prisma.bill.findMany({ where: { userId, dueDate: { gte: start, lte: end } } }),
      prisma.investment.findMany({ where: { userId } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.income.findMany({
        where: { userId, date: { gte: sixMonthsAgo, lte: end } },
        select: { date: true, value: true },
      }),
      prisma.expense.findMany({
        where: { userId, date: { gte: sixMonthsAgo, lte: end } },
        select: { date: true, value: true },
      }),
      prisma.bill.findMany({
        where: { userId, paid: true, dueDate: { gte: sixMonthsAgo, lte: end } },
        select: { dueDate: true, value: true },
      }),
    ]);

    const totalIncome   = incomes.reduce((s, i) => s + toNum(i.value), 0);
    const totalExpenses = expenses.reduce((s, e) => s + toNum(e.value), 0);
    const balance       = totalIncome - totalExpenses;

    const totalPaid    = bills.filter(b =>  b.paid).reduce((s, b) => s + toNum(b.value), 0);
    const totalPending = bills.filter(b => !b.paid).reduce((s, b) => s + toNum(b.value), 0);

    const balanceReal     = totalIncome - totalExpenses - totalPaid;
    const balancePrevisto = totalIncome - totalExpenses - totalPaid - totalPending;

    // overdueBills calculado em memória (consistente com /bills)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdueBills = bills.filter(b => {
      if (b.paid) return false;
      const due = new Date(b.dueDate); due.setHours(0, 0, 0, 0);
      return due < today;
    }).length;

    const expensesByCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + toNum(e.value);
      return acc;
    }, {});

    // healthScore inclui todas as saídas (despesas + contas)
    const totalSaidas = totalExpenses + totalPaid + totalPending;
    const healthScore = totalIncome > 0
      ? Math.max(0, Math.min(100, Math.round(((totalIncome - totalSaidas) / totalIncome) * 100)))
      : 0;

    // Evolução 6 meses com linha de contas pagas
    const monthlyEvolution = Array.from({ length: 6 }, (_, i) => {
      const d  = subMonths(refDate, 5 - i);
      const ms = startOfMonth(d);
      const me = endOfMonth(d);

      const income = allHistInc
        .filter(r => new Date(r.date) >= ms && new Date(r.date) <= me)
        .reduce((s, r) => s + toNum(r.value), 0);
      const exp = allHistExp
        .filter(r => new Date(r.date) >= ms && new Date(r.date) <= me)
        .reduce((s, r) => s + toNum(r.value), 0);
      const billsPaid = allHistBills
        .filter(r => new Date(r.dueDate) >= ms && new Date(r.dueDate) <= me)
        .reduce((s, r) => s + toNum(r.value), 0);

      return { month: format(d, 'MMM/yy'), income, expenses: exp, billsPaid };
    });

    // Mês anterior para indicadores de tendência
    const prev = monthlyEvolution[monthlyEvolution.length - 2];
    const prevMonth = {
      income:   prev?.income   ?? 0,
      expenses: prev?.expenses ?? 0,
    };

    const totalInvested = investments.reduce((s, i) => s + toNum(i.currentValue), 0);
    const totalGoals    = goals.reduce((s, g) => s + toNum(g.targetValue), 0);
    const goalsProgress = totalGoals > 0
      ? Math.round((goals.reduce((s, g) => s + toNum(g.currentValue), 0) / totalGoals) * 100)
      : 0;

    res.json({
      balance, totalIncome, totalExpenses,
      totalPaid, totalPending,
      balanceReal, balancePrevisto,
      expensesByCategory, monthlyEvolution,
      healthScore, totalInvested, goalsProgress,
      overdueBills, prevMonth,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
