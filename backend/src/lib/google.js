const { google } = require('googleapis');
const prisma = require('./prisma');

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
];

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getAuthUrl(userId) {
  return createOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent', // força retorno de refresh_token em toda autorização
    scope:       SCOPES,
    state:       userId,
  });
}

async function exchangeCodeForTokens(code) {
  const { tokens } = await createOAuthClient().getToken(code);
  return tokens;
}

async function getAuthenticatedClient(userId) {
  const integration = await prisma.googleIntegration.findUnique({ where: { userId } });
  if (!integration) {
    throw Object.assign(new Error('Integração com Google não configurada'), { status: 404 });
  }
  if (!integration.enabled) {
    throw Object.assign(new Error('Integração Google desabilitada'), { status: 400 });
  }

  const client = createOAuthClient();
  client.setCredentials({
    access_token:  integration.accessToken,
    refresh_token: integration.refreshToken,
    expiry_date:   integration.expiresAt.getTime(),
  });

  // Persiste novos tokens automaticamente após refresh automático
  client.on('tokens', async (newTokens) => {
    const data = {};
    if (newTokens.access_token)  data.accessToken  = newTokens.access_token;
    if (newTokens.refresh_token) data.refreshToken = newTokens.refresh_token;
    if (newTokens.expiry_date)   data.expiresAt    = new Date(newTokens.expiry_date);
    if (Object.keys(data).length > 0) {
      await prisma.googleIntegration.update({ where: { userId }, data }).catch(console.error);
    }
  });

  return client;
}

async function getSheetsClient(userId) {
  const auth = await getAuthenticatedClient(userId);
  return google.sheets({ version: 'v4', auth });
}

async function disconnect(userId) {
  const integration = await prisma.googleIntegration.findUnique({ where: { userId } });
  if (!integration) return;

  try {
    const client = createOAuthClient();
    client.setCredentials({ refresh_token: integration.refreshToken });
    await client.revokeCredentials();
  } catch (e) {
    console.warn('[google] Falha ao revogar token (ignorado):', e.message);
  }

  await prisma.googleIntegration.delete({ where: { userId } });
}

module.exports = { getAuthUrl, exchangeCodeForTokens, getSheetsClient, disconnect };
