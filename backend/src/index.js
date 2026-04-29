const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const incomeRoutes = require('./routes/income');
const expenseRoutes = require('./routes/expenses');
const billRoutes = require('./routes/bills');
const cardRoutes = require('./routes/cards');
const investmentRoutes = require('./routes/investments');
const goalRoutes = require('./routes/goals');
const planningRoutes = require('./routes/planning');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());

// #2 fix: never mix wildcard origin with credentials
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
}));

app.use(express.json());

// Global limiter (generous — bots still get blocked)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

// #9 fix: tight limiter on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/incomes', incomeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/planning', planningRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`FinCouple API rodando na porta ${PORT}`);
});
