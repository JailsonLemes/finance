import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, ExternalLink, CheckCircle2, AlertCircle, Unlink, Link } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '../services/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type SyncStat = {
  entity:          string;
  sheetToDbCreated: number;
  sheetToDbUpdated: number;
  dbToSheetCreated: number;
  skippedInvalid:   number;
};

type Integration = {
  id:             string;
  enabled:        boolean;
  spreadsheetId:  string | null;
  spreadsheetUrl: string | null;
  lastSyncAt:     string | null;
  lastSyncStatus: 'success' | 'error' | 'in_progress' | null;
  lastSyncError:  string | null;
  createdAt:      string;
};

type StatusResponse = { connected: boolean; integration: Integration | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ENTITY_LABEL: Record<string, string> = {
  incomes:     'Receitas',
  expenses:    'Despesas',
  bills:       'Contas a pagar',
  investments: 'Investimentos',
  goals:       'Metas',
};

const OAUTH_ERRORS: Record<string, string> = {
  sem_refresh_token:       'O Google não devolveu refresh token. Acesse myaccount.google.com/permissions, remova o acesso ao FinCouple e tente novamente.',
  callback_invalido:       'Callback inválido — tente conectar novamente.',
  usuario_nao_encontrado:  'Usuário não encontrado.',
  falha_no_callback:       'Erro ao processar retorno do Google. Tente novamente.',
};

// ─── Componentes menores ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const map: Record<string, { cls: string; label: string }> = {
    success:     { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', label: 'Sucesso' },
    error:       { cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',                 label: 'Erro'    },
    in_progress: { cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',             label: 'Em andamento' },
  };
  const c = map[status] ?? { cls: 'bg-gray-100 text-gray-600', label: status };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${c.cls}`}>{c.label}</span>;
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status,     setStatus]     = useState<StatusResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [syncing,    setSyncing]    = useState(false);
  const [lastStats,  setLastStats]  = useState<SyncStat[] | null>(null);
  const [feedback,   setFeedback]   = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<StatusResponse>('/integrations/google/status');
      setStatus(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();

    const connected = searchParams.get('connected');
    const error     = searchParams.get('error');

    if (connected === '1') {
      setFeedback({ kind: 'ok', msg: 'Conta Google conectada com sucesso!' });
      searchParams.delete('connected');
      setSearchParams(searchParams, { replace: true });
    } else if (error) {
      setFeedback({ kind: 'err', msg: OAUTH_ERRORS[error] ?? `Erro: ${error}` });
      searchParams.delete('error');
      setSearchParams(searchParams, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    try {
      const { data } = await api.get<{ url: string }>('/integrations/google/auth-url');
      window.location.href = data.url;
    } catch (e: any) {
      setFeedback({ kind: 'err', msg: e?.response?.data?.error ?? 'Erro ao iniciar conexão' });
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Desconectar do Google? Sua planilha não será apagada.')) return;
    try {
      await api.delete('/integrations/google');
      setFeedback({ kind: 'ok', msg: 'Desconectado com sucesso.' });
      setLastStats(null);
      loadStatus();
    } catch (e: any) {
      setFeedback({ kind: 'err', msg: e?.response?.data?.error ?? 'Erro ao desconectar' });
    }
  };

  const sync = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const { data } = await api.post<{ success: boolean; stats: SyncStat[] }>('/integrations/google/sync');
      setLastStats(data.stats);
      setFeedback({ kind: 'ok', msg: 'Sincronização concluída com sucesso.' });
      loadStatus();
    } catch (e: any) {
      setFeedback({ kind: 'err', msg: e?.response?.data?.error ?? 'Erro ao sincronizar' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const connected   = !!status?.integration;
  const integration = status?.integration;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Integrações</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Sincronize seus dados com outros serviços</p>
      </div>

      {/* Feedback toast */}
      {feedback && (
        <div className={`p-3 rounded-xl text-sm border ${
          feedback.kind === 'ok'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Card Google Sheets */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-emerald-600" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm5 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2zm5 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Google Sheets</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sincronização bidirecional entre o app e uma planilha no seu Google Drive
              </p>
            </div>
          </div>

          {connected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              Desconectado
            </span>
          )}
        </div>

        {!connected ? (
          <div className="mt-5">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Ao conectar, criamos automaticamente uma planilha no seu Google Drive chamada{' '}
              <strong>FinCouple — Controle Financeiro</strong> com uma aba para cada tipo de dado
              (Receitas, Despesas, Contas, Investimentos e Metas).
              Você pode editar a planilha manualmente — na próxima sincronização as alterações entram no app.
            </p>
            <button onClick={connect} className="btn-primary inline-flex items-center gap-2 text-sm">
              <Link className="w-4 h-4" /> Conectar com Google
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Última sincronização</p>
                <p className="text-sm text-gray-900 dark:text-white mt-0.5">
                  {integration!.lastSyncAt
                    ? format(new Date(integration!.lastSyncAt), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })
                    : 'Nunca'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</p>
                <p className="mt-0.5"><StatusBadge status={integration!.lastSyncStatus} /></p>
              </div>
            </div>

            {/* Error block */}
            {integration!.lastSyncError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Erro na última sincronização:</p>
                    <p className="mt-1 text-xs opacity-90">{integration!.lastSyncError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={sync}
                disabled={syncing}
                className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar agora'}
              </button>

              {integration!.spreadsheetUrl && (
                <a
                  href={integration!.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary inline-flex items-center gap-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4" /> Abrir planilha
                </a>
              )}

              <button
                onClick={disconnect}
                className="btn-secondary inline-flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
              >
                <Unlink className="w-4 h-4" /> Desconectar
              </button>
            </div>

            {/* Sync stats */}
            {lastStats && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Resumo da última sincronização
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 dark:text-gray-400 text-left">
                        <th className="py-1.5 pr-3 font-medium">Entidade</th>
                        <th className="py-1.5 px-2 font-medium text-center">Sheets→App (novo)</th>
                        <th className="py-1.5 px-2 font-medium text-center">Sheets→App (atualiz.)</th>
                        <th className="py-1.5 px-2 font-medium text-center">App→Sheets (novo)</th>
                        <th className="py-1.5 px-2 font-medium text-center">Inválidas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastStats.map((s) => (
                        <tr key={s.entity} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="py-1.5 pr-3 text-gray-900 dark:text-white">{ENTITY_LABEL[s.entity] ?? s.entity}</td>
                          <td className="py-1.5 px-2 text-center">{s.sheetToDbCreated}</td>
                          <td className="py-1.5 px-2 text-center">{s.sheetToDbUpdated}</td>
                          <td className="py-1.5 px-2 text-center">{s.dbToSheetCreated}</td>
                          <td className="py-1.5 px-2 text-center text-gray-500">{s.skippedInvalid || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="card p-5 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/40">
        <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
          ℹ️ Como funciona o sync
        </h4>
        <ul className="text-xs text-amber-800 dark:text-amber-300 space-y-1 list-disc list-inside">
          <li>Linhas novas em qualquer lado são propagadas para o outro</li>
          <li>Em conflito (linha existe nos dois com conteúdo diferente), <strong>a planilha vence</strong></li>
          <li><strong>Apagar uma linha na planilha NÃO remove do app</strong> — exclua dentro do FinCouple</li>
          <li>A coluna ID é gerenciada pelo sistema — não altere manualmente</li>
        </ul>
      </div>
    </div>
  );
}
