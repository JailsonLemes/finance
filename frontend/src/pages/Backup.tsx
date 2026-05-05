import { useEffect, useState } from 'react';
import { Upload, Download, RotateCcw, AlertTriangle, HardDrive, RefreshCw, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';
import Modal from '../components/Modal';

interface BackupFile {
  name: string;
  size: number;
  modified?: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseBackupDate(name: string): string {
  const m = name.match(/backup_(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})/);
  if (!m) return name;
  const [, year, month, day, hour, min, sec] = m;
  return `${day}/${month}/${year} ${hour}:${min}:${sec}`;
}

export default function BackupPage() {
  const [backups, setBackups]           = useState<BackupFile[]>([]);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
  const [restoring, setRestoring]       = useState(false);
  const [downloading, setDownloading]   = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/backup/list');
      setBackups(data.files);
    } catch {
      setError('Não foi possível listar backups. Verifique se o rclone está configurado.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError(null);
      setSuccess(null);
      const { data } = await api.post('/backup/create');
      setSuccess(`Backup criado: ${data.name} (${formatSize(data.size)})`);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao criar backup.');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (file: BackupFile) => {
    try {
      setDownloading(file.name);
      const res = await api.get(`/backup/download/${file.name}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Erro ao baixar o arquivo.');
    } finally {
      setDownloading(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      setRestoring(true);
      setError(null);
      await api.post(`/backup/restore/${restoreTarget.name}`);
      setSuccess(`Restauração concluída a partir de: ${restoreTarget.name}`);
      setRestoreTarget(null);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao restaurar backup.');
      setRestoreTarget(null);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Backup & Restauração</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Backups armazenados no Google Drive via rclone</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button onClick={handleCreate} disabled={creating || loading} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60">
            {creating
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Criando...</>
              : <><Upload className="w-4 h-4" /> Fazer Backup</>
            }
          </button>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
            {error.includes('rclone') && (
              <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                Execute <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">rclone config</code> no servidor e configure um remote chamado <strong>gdrive</strong>.
              </p>
            )}
          </div>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-sm text-emerald-700 dark:text-emerald-400">
          {success}
        </div>
      )}

      {/* Info */}
      <div className="card p-4 flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary-500" />
        <p>
          Os backups são dumps completos do banco de dados comprimidos com gzip.
          Para configurar o Google Drive, instale o rclone e execute{' '}
          <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">rclone config</code>{' '}
          criando um remote chamado <strong>gdrive</strong>.
        </p>
      </div>

      {/* Lista de backups */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">
            Backups no Google Drive
          </span>
          {!loading && (
            <span className="ml-auto text-xs text-gray-400">{backups.length} arquivo{backups.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-600 text-sm">
            Nenhum backup encontrado. Clique em <strong>Fazer Backup</strong> para criar o primeiro.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {backups.map(file => (
              <li key={file.name} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {parseBackupDate(file.name)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatSize(file.size)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(file)}
                    disabled={downloading === file.name}
                    title="Baixar arquivo"
                    className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-40"
                  >
                    {downloading === file.name
                      ? <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                      : <Download className="w-4 h-4" />
                    }
                  </button>
                  <button
                    onClick={() => setRestoreTarget(file)}
                    title="Restaurar este backup"
                    className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal de confirmação de restauração */}
      <Modal open={!!restoreTarget} onClose={() => setRestoreTarget(null)} title="Restaurar Backup">
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700 dark:text-amber-400">
              <p className="font-semibold">Atenção: esta ação substituirá todos os dados atuais.</p>
              <p className="mt-1">Recomendamos fazer um novo backup antes de restaurar.</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            Restaurar o backup de{' '}
            <strong className="text-gray-900 dark:text-white">
              {restoreTarget && parseBackupDate(restoreTarget.name)}
            </strong>?
          </p>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setRestoreTarget(null)} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="flex-1 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {restoring
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Restaurando...</>
                : <><RotateCcw className="w-4 h-4" /> Restaurar</>
              }
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
