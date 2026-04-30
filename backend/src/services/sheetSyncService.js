const prisma = require('../lib/prisma');
const { getSheetsClient } = require('../lib/google');
const { ALL_ADAPTERS } = require('./entityAdapters');

async function ensureSpreadsheet(userId) {
  const integration = await prisma.googleIntegration.findUnique({ where: { userId } });
  const sheets = await getSheetsClient(userId);
  let { spreadsheetId, spreadsheetUrl } = integration;

  if (!spreadsheetId) {
    const created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: 'FinCouple — Controle Financeiro' },
        sheets: ALL_ADAPTERS.map((a) => ({ properties: { title: a.sheetTab } })),
      },
    });
    spreadsheetId = created.data.spreadsheetId;
    spreadsheetUrl = created.data.spreadsheetUrl;

    // Escreve cabeçalhos
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: ALL_ADAPTERS.map((a) => ({ range: `${a.sheetTab}!A1`, values: [a.headers] })),
      },
    });

    // Formata: negrito + fundo cinza + freeze linha 1
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const requests = meta.data.sheets.flatMap((tab) => [
      {
        repeatCell: {
          range: { sheetId: tab.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { backgroundColor: { red: 0.92, green: 0.92, blue: 0.95 }, textFormat: { bold: true } } },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      },
      {
        updateSheetProperties: {
          properties: { sheetId: tab.properties.sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      },
    ]);
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    await prisma.googleIntegration.update({ where: { userId }, data: { spreadsheetId, spreadsheetUrl } });
  } else {
    // Garante que abas faltantes sejam criadas
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = new Set(meta.data.sheets.map((s) => s.properties.title));
    const missing = ALL_ADAPTERS.filter((a) => !existing.has(a.sheetTab));
    if (missing.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: missing.map((a) => ({ addSheet: { properties: { title: a.sheetTab } } })) },
      });
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: missing.map((a) => ({ range: `${a.sheetTab}!A1`, values: [a.headers] })),
        },
      });
    }
  }

  return { spreadsheetId };
}

async function syncEntity(userId, adapter, sheets, spreadsheetId) {
  const stats = { entity: adapter.key, sheetToDbCreated: 0, sheetToDbUpdated: 0, dbToSheetCreated: 0, skippedInvalid: 0 };

  // 1. Lê planilha
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${adapter.sheetTab}!A2:Z` });
  const sheetItems = (resp.data.values || [])
    .map((row) => ({ data: adapter.fromRow(row), raw: row }))
    .filter((s) => s.data && (s.data.id || s.raw.some((c) => c?.trim())));

  // 2. Lê DB
  const dbItems = await prisma[adapter.prismaModel].findMany({ where: { userId } });
  const dbById  = new Map(dbItems.map((it) => [it.id, it]));
  const seenIds = new Set();

  // 3. Aplica mudanças planilha → DB (planilha vence em conflito)
  for (const { data } of sheetItems) {
    const err = adapter.validate(data);
    if (err) { stats.skippedInvalid++; continue; }

    if (!data.id) {
      try {
        await prisma[adapter.prismaModel].create({ data: { userId, ...data } });
        stats.sheetToDbCreated++;
      } catch (e) { console.error(`[sync] Falha ao criar ${adapter.key}:`, e.message); stats.skippedInvalid++; }
    } else {
      seenIds.add(data.id);
      const dbItem = dbById.get(data.id);
      if (dbItem && adapter.fingerprint(data) !== adapter.fingerprint(dbItem)) {
        try {
          await prisma[adapter.prismaModel].updateMany({ where: { id: data.id, userId }, data });
          stats.sheetToDbUpdated++;
        } catch (e) { console.error(`[sync] Falha ao atualizar ${adapter.key}:`, e.message); stats.skippedInvalid++; }
      }
    }
  }

  // 4. Reescreve aba com estado final do DB
  const finalItems = await prisma[adapter.prismaModel].findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  finalItems.filter((it) => !seenIds.has(it.id)).forEach(() => stats.dbToSheetCreated++);

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${adapter.sheetTab}!A2:Z` });
  if (finalItems.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${adapter.sheetTab}!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: finalItems.map((it) => adapter.toRow(it)) },
    });
  }

  return stats;
}

async function runFullSync(userId) {
  await prisma.googleIntegration.update({ where: { userId }, data: { lastSyncStatus: 'in_progress', lastSyncError: null } });
  try {
    const { spreadsheetId } = await ensureSpreadsheet(userId);
    const sheets = await getSheetsClient(userId);
    const allStats = [];
    for (const adapter of ALL_ADAPTERS) {
      allStats.push(await syncEntity(userId, adapter, sheets, spreadsheetId));
    }
    await prisma.googleIntegration.update({ where: { userId }, data: { lastSyncAt: new Date(), lastSyncStatus: 'success', lastSyncError: null } });
    return { success: true, stats: allStats };
  } catch (err) {
    await prisma.googleIntegration.update({ where: { userId }, data: { lastSyncStatus: 'error', lastSyncError: String(err.message).slice(0, 1000) } });
    throw err;
  }
}

module.exports = { runFullSync };
