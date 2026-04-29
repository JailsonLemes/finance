const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { startOfMonth, endOfMonth, subMonths, format } = require('date-fns');

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const refDate = new Date(year || now.getFullYear(), (month ? month - 1 : now.getMonth()), 1);
    const start = startOfMonth(refDate);
    const end = endOfMonth(refDate);
    const userId = req.userId;

    // Fetch current month + 6-month window in parallel (2 queries instead of 12)
    const sixMonthsAgo = startOfMonth(subMonths(refDate, 5));

    const [incomes, expenses, bills, investments, goals, allHistInc, allHistExp, overdueBills] = await Promise.all([
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
      prisma.bill.count({ where: { userId, paid: false, dueDate: { lt: now } } }),
    ]);

    const totalIncome = incomes.reduce((s, i) => s + i.value, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.value, 0);
    const balance = totalIncome - totalExpenses;

    const totalPaid = bills.filter(b => b.paid).reduce((s, b) => s + b.value, 0);
    const totalPending = bills.filter(b => !b.paid).reduce((s, b) => s + b.value, 0);

    const expensesByCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.value;
      return acc;
    }, {});

    // Build 6-month evolution from the two bulk fetches (no extra queries)
    const monthlyEvolution = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(refDate, 5 - i);
      const ms = startOfMonth(d);
      const me = endOfMonth(d);
      const income = allHistInc
        .filter(r => new Date(r.date) >= ms && new Date(r.date) <= me)
        .reduce((s, r) => s + r.value, 0);
      const exp = allHistExp
        .filter(r => new Date(r.date) >= ms && new Date(r.date) <= me)
        .reduce((s, r) => s + r.value, 0);
      return { month: format(d, 'MMM/yy'), income, expenses: exp };
    });

    // #5 fix: healthScore clamped to [0, 100]
    const healthScore = totalIncome > 0
      ? Math.max(0, Math.min(100, Math.round(((totalIncome - totalExpenses) / totalIncome) * 100)))
      : 0;

    const totalInvested = investments.reduce((s, i) => s + i.currentValue, 0);
    const totalGoals = goals.reduce((s, g) => s + g.targetValue, 0);
    const goalsProgress = totalGoals > 0
      ? Math.round((goals.reduce((s, g) => s + g.currentValue, 0) / totalGoals) * 100)
      : 0;

    res.json({
      balance,
      totalIncome,
      totalExpenses,
      totalPaid,
      totalPending,
      expensesByCategory,
      monthlyEvolution,
      healthScore,
      totalInvested,
      goalsProgress,
      overdueBills,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
