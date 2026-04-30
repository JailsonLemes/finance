const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authMiddleware } = require('../middleware/auth');
const { getAuthUrl, exchangeCodeForTokens, disconnect } = require('../lib/google');
const { runFullSync } = require('../services/sheetSyncService');

// GET /api/integrations/google/auth-url
router.get('/google/auth-url', authMiddleware, async (req, res, next) => {
  try {
    res.json({ url: getAuthUrl(req.userId) });
  } catch (e) { next(e); }
});

// GET /api/integrations/google/callback — chamado pelo Google após autorização
// Não usa authMiddleware; recupera userId do parâmetro `state`.
router.get('/google/callback', async (req, res) => {
  const frontUrl = process.env.FRONTEND_URL || 'http://localhost';
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`${frontUrl}/integracoes?error=${encodeURIComponent(error)}`);
    if (!code || !state) return res.redirect(`${frontUrl}/integracoes?error=callback_invalido`);

    const userId = String(state);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.redirect(`${frontUrl}/integracoes?error=usuario_nao_encontrado`);

    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Acontece quando o usuário já autorizou antes. Solução: revogar em
      // myaccount.google.com/permissions e tentar novamente.
      return res.redirect(`${frontUrl}/integracoes?error=sem_refresh_token`);
    }

    await prisma.googleIntegration.upsert({
      where: { userId },
      update: {
        accessToken:    tokens.access_token,
        refreshToken:   tokens.refresh_token,
        expiresAt:      new Date(tokens.expiry_date || Date.now() + 3600_000),
        enabled:        true,
        lastSyncStatus: null,
        lastSyncError:  null,
      },
      create: {
        userId,
        accessToken:  tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt:    new Date(tokens.expiry_date || Date.now() + 3600_000),
        enabled:      true,
      },
    });

    res.redirect(`${frontUrl}/integracoes?connected=1`);
  } catch (e) {
    console.error('[oauth callback]', e);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost'}/integracoes?error=falha_no_callback`);
  }
});

// GET /api/integrations/google/status
router.get('/google/status', authMiddleware, async (req, res, next) => {
  try {
    const integration = await prisma.googleIntegration.findUnique({
      where: { userId: req.userId },
      select: {
        id: true, enabled: true, spreadsheetId: true, spreadsheetUrl: true,
        lastSyncAt: true, lastSyncStatus: true, lastSyncError: true, createdAt: true,
      },
    });
    res.json({ connected: !!integration, integration });
  } catch (e) { next(e); }
});

// POST /api/integrations/google/sync
router.post('/google/sync', authMiddleware, async (req, res, next) => {
  try {
    const integration = await prisma.googleIntegration.findUnique({ where: { userId: req.userId } });
    if (!integration)                               return res.status(404).json({ error: 'Conecte sua conta Google primeiro' });
    if (integration.lastSyncStatus === 'in_progress') return res.status(409).json({ error: 'Sincronização já em andamento' });

    const result = await runFullSync(req.userId);
    res.json(result);
  } catch (e) { next(e); }
});

// DELETE /api/integrations/google
router.delete('/google', authMiddleware, async (req, res, next) => {
  try {
    await disconnect(req.userId);
    res.json({ success: true });
  } catch (e) { next(e); }
});

module.exports = router;
