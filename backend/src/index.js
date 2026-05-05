const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ─── Validação de envs críticas no startup ────────────────────────────────────
const REQUIRED = ['JWT_SECRET', 'DATABASE_URL'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`FATAL: variável de ambiente obrigatória ausente: ${key}`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET deve ter no mínimo 32 caracteres. Gere com: openssl rand -base64 48');
  process.exit(1);
}
const GOOGLE_VARS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
for (const key of GOOGLE_VARS) {
  if (!process.env[key]) {
    console.warn(`AVISO: ${key} ausente — integração Google Sheets não funcionará`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const authRoutes        = require('./routes/auth');
const dashboardRoutes   = require('./routes/dashboard');
const incomeRoutes      = require('./routes/income');
const expenseRoutes     = require('./routes/expenses');
const billRoutes        = require('./routes/bills');
const cardRoutes        = require('./routes/cards');
const investmentRoutes  = require('./routes/investments');
const goalRoutes        = require('./routes/goals');
const planningRoutes    = require('./routes/planning');
const integrationRoutes = require('./routes/integrations');
const backupRoutes      = require('./routes/backup');
const { errorHandler }  = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost',
  credentials: true,
}));

app.use(express.json());

// Rate limit global — valor alto para suportar importações em lote
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 2000 });
app.use(limiter);

// Rate limit específico para auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
});
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// Rate limit específico para sync (evita spam no botão)
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Aguarde alguns segundos antes de sincronizar novamente.' },
});
app.use('/api/integrations/google/sync', syncLimiter);

// Rotas
app.use('/api/auth',         authRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/incomes',      incomeRoutes);
app.use('/api/expenses',     expenseRoutes);
app.use('/api/bills',        billRoutes);
app.use('/api/cards',        cardRoutes);
app.use('/api/investments',  investmentRoutes);
app.use('/api/goals',        goalRoutes);
app.use('/api/planning',     planningRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/backup',      backupRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`FinCouple API rodando na porta ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
