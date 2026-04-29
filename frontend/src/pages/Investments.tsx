import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import Modal from '../components/Modal';
import { Investment, INVESTMENT_TYPES } from '../types';
import { fmt } from '../utils/fmt';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

type FormData = {
  type: string; description: string;
  investedValue: string; currentValue: string;
  profitability: string; date: string;
};

export default function InvestmentsPage() {
  const [items, setItems] = useState<Investment[]>([]);
  const [summary, setSummary] = useState({ totalInvested: 0, totalCurrent: 0, totalReturn: 0, returnPercent: 0, byType: {} as Record<string, number> });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm<FormData>();

  const load = async () => {
    const { data } = await api.get('/investments');
    setItems(data.items);
    setSummary({ totalInvested: data.totalInvested, totalCurrent: data.totalCurrent, totalReturn: data.totalReturn, returnPercent: data.returnPercent, byType: data.byType });
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    reset({ date: format(new Date(), 'yyyy-MM-dd'), type: 'fixed_income', profitability: '0' });
    setModal(true);
  };

  const openEdit = (item: Investment) => {
    setEditing(item);
    reset({
      type: item.type,
      description: item.description,
      investedValue: String(item.investedValue),
      currentValue: String(item.currentValue),
      profitability: String(item.profitability),
      date: format(new Date(item.date), 'yyyy-MM-dd'),
    });
    setModal(true);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      if (editing) {
        await api.put(`/investments/${editing.id}`, data);
      } else {
        await api.post('/investments', data);
      }
      setModal(false);
      load();
    } finally { setLoading(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover investimento?')) return;
    await api.delete(`/investments/${id}`);
    load();
  };

  const typeLabel = (type: string) => INVESTMENT_TYPES.find(t => t.value === type)?.label || type;

  const pieData = Object.entries(summary.byType).map(([name, value]) => ({
    name: typeLabel(name), value,
  }));

  const positive = summary.totalReturn >= 0;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Novo Investimento
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Investido</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt(summary.totalInvested)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Valor Atual</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt(summary.totalCurrent)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Rentabilidade Total</p>
          <div className="flex items-center gap-2 mt-1">
            {positive ? <TrendingUp className="w-5 h-5 text-emerald-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
            <p className={`text-2xl font-bold ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {positive ? '+' : ''}{fmt(summary.totalReturn)}
            </p>
            <span className={`text-sm font-medium px-2 py-0.5 rounded-lg ${positive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
              {positive ? '+' : ''}{summary.returnPercent}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Table */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Descrição</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Tipo</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Investido</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Atual</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Retorno</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400 dark:text-gray-600">Nenhum investimento cadastrado</td></tr>
                ) : items.map(item => {
                  const ret = item.currentValue - item.investedValue;
                  const retPct = item.investedValue > 0 ? ((ret / item.investedValue) * 100).toFixed(1) : '0';
                  const pos = ret >= 0;
                  return (
                    <tr key={item.id} className="table-row">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{item.description}</p>
                        <p className="text-xs text-gray-400">{format(new Date(item.date), 'dd/MM/yyyy')}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-lg">{typeLabel(item.type)}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{fmt(item.investedValue)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white hidden md:table-cell">{fmt(item.currentValue)}</td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className={`text-sm font-semibold ${pos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {pos ? '+' : ''}{fmt(ret)} ({pos ? '+' : ''}{retPct}%)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => remove(item.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Distribuição</h3>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {pieData.map(({ name, value }, i) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600 dark:text-gray-400">{name}</span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{fmt(value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">Sem investimentos</div>
          )}
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Investimento' : 'Novo Investimento'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Descrição</label>
            <input {...register('description', { required: true })} className="input" placeholder="Ex: Tesouro Direto IPCA+" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select {...register('type', { required: true })} className="input">
                {INVESTMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Data</label>
              <input type="date" {...register('date', { required: true })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor investido (R$)</label>
              <input type="number" step="0.01" {...register('investedValue', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">Valor atual (R$)</label>
              <input type="number" step="0.01" {...register('currentValue', { required: true })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Rentabilidade anual (%)</label>
            <input type="number" step="0.01" {...register('profitability')} className="input" placeholder="0.00" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
