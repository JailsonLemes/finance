import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Download, AlertTriangle, RefreshCw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import Modal from '../components/Modal';
import MonthPicker from '../components/MonthPicker';
import { Expense, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { fmt } from '../utils/fmt';
import { CHART_COLORS } from '../utils/colors';

type FormData = {
  date: string; description: string; category: string; subcategory: string;
  value: string; person: string; paymentMethod: string; dueDate: string; cardId: string;
  installmentTotal: string;
};

type InstallmentMode = 'single' | 'remaining' | 'all';

export default function ExpensesPage() {
  const { user } = useAuth();
  const [items, setItems]           = useState<Expense[]>([]);
  const [total, setTotal]           = useState(0);
  const [byCategory, setByCategory] = useState<Record<string, number>>({});
  const [date, setDate]             = useState(new Date());
  const [modal, setModal]           = useState(false);
  const [editing, setEditing]       = useState<Expense | null>(null);
  const [loading, setLoading]       = useState(false);
  const [pageError, setPageError]   = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cards, setCards]           = useState<{ id: string; name: string }[]>([]);

  // Delete modal: covers both simple and installment cases
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  // Edit-mode modal for installment expenses
  const [editModeResolve, setEditModeResolve] =
    useState<((m: InstallmentMode | null) => void) | null>(null);

  const { register, handleSubmit, reset, watch } = useForm<FormData>();
  const paymentMethod    = watch('paymentMethod');
  const installmentTotal = watch('installmentTotal');
  const isInstallment    = parseInt(installmentTotal) > 1;

  const load = async (d: Date) => {
    try {
      setPageError(null);
      const [expRes, cardRes] = await Promise.all([
        api.get('/expenses', { params: { month: d.getMonth() + 1, year: d.getFullYear() } }),
        api.get('/cards'),
      ]);
      setItems(expRes.data.items);
      setTotal(expRes.data.total);
      setByCategory(expRes.data.byCategory);
      setCards(cardRes.data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    } catch {
      setPageError('Erro ao carregar despesas. Tente novamente.');
    }
  };

  useEffect(() => { load(date); }, [date]);

  const openNew = () => {
    setEditing(null);
    setSubmitError(null);
    reset({ date: format(new Date(), 'yyyy-MM-dd'), person: 'partner1', paymentMethod: 'PIX', installmentTotal: '' });
    setModal(true);
  };

  const openEdit = (item: Expense) => {
    setEditing(item);
    setSubmitError(null);
    reset({
      date:             format(new Date(item.date), 'yyyy-MM-dd'),
      description:      item.description,
      category:         item.category,
      subcategory:      item.subcategory || '',
      value:            String(item.value),
      person:           item.person,
      paymentMethod:    item.paymentMethod,
      dueDate:          item.dueDate ? format(new Date(item.dueDate), 'yyyy-MM-dd') : '',
      cardId:           item.cardId || '',
      installmentTotal: item.installmentTotal != null ? String(item.installmentTotal) : '',
    });
    setModal(true);
  };

  const askEditMode = (): Promise<InstallmentMode | null> =>
    new Promise(resolve => setEditModeResolve(() => resolve));

  const resolveEditMode = (mode: InstallmentMode | null) => {
    editModeResolve?.(mode);
    setEditModeResolve(null);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setSubmitError(null);
      const total = parseInt(data.installmentTotal) || 1;
      const payload = {
        ...data,
        dueDate:          data.dueDate || null,
        cardId:           data.cardId  || null,
        installmentTotal: total > 1 ? total : null,
        installmentCurrent: (!editing && total > 1) ? 1 : (editing?.installmentCurrent ?? null),
      };

      if (editing) {
        const mode = editing.installmentGroupId ? await askEditMode() : 'single';
        if (mode === null) return;
        await api.put(`/expenses/${editing.id}?mode=${mode}`, payload);
      } else {
        await api.post('/expenses', payload);
      }
      setModal(false);
      await load(date);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar despesa.';
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  const doDelete = async (item: Expense, mode: InstallmentMode) => {
    setDeleteTarget(null);
    try {
      await api.delete(`/expenses/${item.id}?mode=${mode}`);
      await load(date);
    } catch {
      setPageError('Erro ao remover despesa. Tente novamente.');
    }
  };

  const exportXLSX = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(items.map(i => ({
      Data:         format(new Date(i.date), 'dd/MM/yyyy'),
      Descrição:    i.description,
      Categoria:    i.category,
      Subcategoria: i.subcategory || '',
      Valor:        i.value,
      Parcela:      i.installmentTotal ? `${i.installmentCurrent}/${i.installmentTotal}` : '',
      Pessoa:       i.person,
      Pagamento:    i.paymentMethod,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Despesas');
    XLSX.writeFile(wb, `despesas-${format(date, 'MM-yyyy')}.xlsx`);
  };

  // Sort once — used for both Pie slices and legend (colors stay aligned)
  const pieData = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <MonthPicker date={date} onChange={setDate} />
        <div className="flex gap-2">
          <button onClick={exportXLSX} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Despesa
          </button>
        </div>
      </div>

      {/* Page-level error */}
      {pageError && (
        <div className="card p-4 flex items-center justify-between gap-3 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {pageError}
          </div>
          <button onClick={() => load(date)} className="btn-secondary flex items-center gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Recarregar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4 flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400 text-sm">{items.length} despesa{items.length !== 1 ? 's' : ''}</span>
            <span className="text-red-600 dark:text-red-400 font-bold text-lg">{fmt(total)}</span>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Data</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Descrição</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Categoria</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Pagamento</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Valor</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-gray-400 dark:text-gray-600">Nenhuma despesa neste período</td></tr>
                  ) : items.map(item => (
                    <tr key={item.id} className="table-row">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{format(new Date(item.date), 'dd/MM')}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{item.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {item.card && <p className="text-xs text-gray-400">{item.card.name}</p>}
                          {item.installmentTotal != null && (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                              {item.installmentCurrent}/{item.installmentTotal}x
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-lg text-xs">{item.category}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">{item.paymentMethod}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-red-600 dark:text-red-400">{fmt(item.value)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pie chart */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Por Categoria</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {pieData.slice(0, 6).map(({ name, value }, i) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-gray-600 dark:text-gray-400">{name}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{fmt(value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">Sem dados</div>
          )}
        </div>
      </div>

      {/* Modal: cadastro/edição */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Despesa' : 'Nova Despesa'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data</label>
              <input type="date" {...register('date', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">Valor (R$)</label>
              <input type="number" step="0.01" {...register('value', { required: true })} className="input" placeholder="0,00" />
            </div>
          </div>
          <div>
            <label className="label">Descrição</label>
            <input {...register('description', { required: true })} className="input" placeholder="Ex: Supermercado" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select {...register('category', { required: true })} className="input">
                <option value="">Selecione...</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Subcategoria</label>
              <input {...register('subcategory')} className="input" placeholder="Opcional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Pessoa</label>
              <select {...register('person')} className="input">
                <option value="partner1">{user?.name}</option>
                {user?.partnerName && <option value="partner2">{user.partnerName}</option>}
                <option value="both">Ambos</option>
              </select>
            </div>
            <div>
              <label className="label">Forma de Pagamento</label>
              <select {...register('paymentMethod', { required: true })} className="input">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {paymentMethod === 'Crédito' && cards.length > 0 && (
            <div>
              <label className="label">Cartão</label>
              <select {...register('cardId')} className="input">
                <option value="">Nenhum</option>
                {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Data de Vencimento (opcional)</label>
            <input type="date" {...register('dueDate')} className="input" />
          </div>

          {/* Parcelamento */}
          <div>
            <label className="label">Total de Parcelas</label>
            <input
              type="number" min="1" max="360"
              {...register('installmentTotal')}
              className="input"
              placeholder="Ex: 60 — deixe vazio para despesa simples"
            />
            {isInstallment && !editing && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                Serão criadas automaticamente <strong>{installmentTotal} despesas</strong>, uma por mês, com os badges 1/{installmentTotal}x … {installmentTotal}/{installmentTotal}x.
              </p>
            )}
            {isInstallment && editing && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Ao salvar, você escolherá se edita só esta parcela, esta e as próximas, ou todas.
              </p>
            )}
          </div>

          {submitError && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {submitError}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-60">
              {loading ? 'Salvando...' : (isInstallment && !editing ? `Criar ${installmentTotal}x parcelas` : 'Salvar')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: seleção de modo de edição para parcelas */}
      <Modal
        open={!!editModeResolve}
        onClose={() => resolveEditMode(null)}
        title="Editar parcela"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Esta despesa é parcelada. O que deseja editar?
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => resolveEditMode('single')}
              className="btn-secondary text-sm text-left px-4 py-3"
            >
              Somente esta parcela
            </button>
            <button
              onClick={() => resolveEditMode('remaining')}
              className="btn-secondary text-sm text-left px-4 py-3 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            >
              Esta e as próximas
            </button>
            <button
              onClick={() => resolveEditMode('all')}
              className="btn-secondary text-sm text-left px-4 py-3 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            >
              Todas as parcelas
            </button>
          </div>
          <button onClick={() => resolveEditMode(null)} className="btn-secondary w-full text-sm">Cancelar</button>
        </div>
      </Modal>

      {/* Modal: exclusão (simples ou parcelada) */}
      {deleteTarget && (
        <Modal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title={deleteTarget.installmentGroupId ? 'Remover parcela' : 'Remover despesa'}
        >
          {deleteTarget.installmentGroupId ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>{deleteTarget.description}</strong> é a parcela{' '}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {deleteTarget.installmentCurrent}/{deleteTarget.installmentTotal}x
                </span>. O que deseja remover?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => doDelete(deleteTarget, 'single')}
                  className="btn-secondary text-sm text-left px-4 py-3"
                >
                  Somente esta parcela ({deleteTarget.installmentCurrent}/{deleteTarget.installmentTotal}x)
                </button>
                <button
                  onClick={() => doDelete(deleteTarget, 'remaining')}
                  className="btn-secondary text-sm text-left px-4 py-3 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  Esta e as próximas ({deleteTarget.installmentCurrent}x → {deleteTarget.installmentTotal}x)
                </button>
                <button
                  onClick={() => doDelete(deleteTarget, 'all')}
                  className="btn-secondary text-sm text-left px-4 py-3 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Todas as {deleteTarget.installmentTotal} parcelas
                </button>
              </div>
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary w-full text-sm">Cancelar</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Confirma a remoção de <strong>{deleteTarget.description}</strong>?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={() => doDelete(deleteTarget, 'single')}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                >
                  Remover
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
