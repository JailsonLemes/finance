const router = require('express').Router();
const { authMiddleware } = require('../middleware/auth');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execFileAsync = promisify(execFile);

router.use(authMiddleware);

// Credenciais a partir do DATABASE_URL (evita duplicar variáveis)
const dbUrl    = new URL(process.env.DATABASE_URL);
const DB_HOST  = dbUrl.hostname;
const DB_PORT  = dbUrl.port || '3306';
const DB_USER  = decodeURIComponent(dbUrl.username);
const DB_PASS  = decodeURIComponent(dbUrl.password);
const DB_NAME  = dbUrl.pathname.slice(1);

const REMOTE = process.env.RCLONE_REMOTE        || 'gdrive';
const FOLDER = process.env.RCLONE_BACKUP_FOLDER || 'fincouple-backups';

// Garante que o nome do arquivo é seguro (evita path traversal / injection)
function isSafeFilename(name) {
  return /^fincouple_backup_[\w\-]+\.sql\.gz$/.test(name);
}

// ─── GET /api/backup/list ────────────────────────────────────────────────────
router.get('/list', async (req, res, next) => {
  try {
    const { stdout } = await execFileAsync('rclone', [
      'lsjson', `${REMOTE}:${FOLDER}`, '--no-modtime',
    ]).catch(() => ({ stdout: '[]' }));

    const files = JSON.parse(stdout || '[]')
      .filter(f => !f.IsDir && f.Name.endsWith('.sql.gz'))
      .map(f => ({ name: f.Name, size: f.Size, modified: f.ModTime }))
      .sort((a, b) => b.name.localeCompare(a.name));

    res.json({ files });
  } catch (e) { next(e); }
});

// ─── POST /api/backup/create ─────────────────────────────────────────────────
router.post('/create', async (req, res, next) => {
  const ts = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' })
               .replace(' ', 'T').replace(/:/g, '-').slice(0, 19);
  const filename = `fincouple_backup_${ts}.sql.gz`;
  const tmpPath  = path.join('/tmp', filename);

  try {
    // mysqldump | gzip  (shell=false → sem injection risk)
    await new Promise((resolve, reject) => {
      const dump = require('child_process').spawn('sh', [
        '-c',
        `mysqldump --single-transaction --no-tablespaces \
          -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASS} \
          ${DB_NAME} | gzip > ${tmpPath}`,
      ]);
      dump.on('close', code => code === 0 ? resolve() : reject(new Error(`mysqldump falhou (código ${code})`)));
    });

    // Envia para o Google Drive
    await execFileAsync('rclone', ['copy', tmpPath, `${REMOTE}:${FOLDER}/`]);

    // Tamanho do arquivo criado
    const size = fs.statSync(tmpPath).size;

    res.json({ name: filename, size });
  } catch (e) {
    next(e);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
});

// ─── POST /api/backup/restore/:filename ─────────────────────────────────────
router.post('/restore/:filename', async (req, res, next) => {
  const { filename } = req.params;
  if (!isSafeFilename(filename)) {
    return res.status(400).json({ error: 'Nome de arquivo inválido' });
  }

  const tmpPath = path.join('/tmp', filename);

  try {
    // Baixa do Google Drive
    await execFileAsync('rclone', ['copy', `${REMOTE}:${FOLDER}/${filename}`, '/tmp/']);

    // Restaura
    await new Promise((resolve, reject) => {
      const restore = require('child_process').spawn('sh', [
        '-c',
        `gunzip -c ${tmpPath} | mysql \
          -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASS} ${DB_NAME}`,
      ]);
      restore.on('close', code => code === 0 ? resolve() : reject(new Error(`Restauração falhou (código ${code})`)));
    });

    res.json({ success: true });
  } catch (e) {
    next(e);
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
});

// ─── GET /api/backup/download/:filename ──────────────────────────────────────
router.get('/download/:filename', async (req, res, next) => {
  const { filename } = req.params;
  if (!isSafeFilename(filename)) {
    return res.status(400).json({ error: 'Nome de arquivo inválido' });
  }

  const tmpPath = path.join('/tmp', filename);

  try {
    await execFileAsync('rclone', ['copy', `${REMOTE}:${FOLDER}/${filename}`, '/tmp/']);

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/gzip');

    const stream = fs.createReadStream(tmpPath);
    stream.pipe(res);
    stream.on('end',   () => { try { fs.unlinkSync(tmpPath); } catch {} });
    stream.on('error', next);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
