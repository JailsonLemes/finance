import { useEffect, useState } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../services/api';
import Modal from '../components/Modal';
import MonthPicker from '../components/MonthPicker';
import { Planning, EXPENSE_CATEGORIES } from '../types';
import { fmt } from '../utils/fmt';

type FormData = { category: string; plannedValue: string; };

export default function PlanningPage() {
  const [items, setItems] = useState<Planning[]>([]);
  const [totals, setTotals] = useState({ totalPlanned: 0, totalRealized: 0 });
  const [date, setDate] = useState(new Date());
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm<FormData>();

  const load = async (d: Date) => {
    const { data } = await api.get('/planning', {
      params: { month: d.getMonth() + 1, year: d.getFullYear() },
    });
    setItems(data.items);
    setTotals({ totalPlanned: data.totalPlanned, totalRealized: data.totalRealized });
  };

  useEffect(() => { load(date); }, [date]);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      await api.post('/planning', {
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        ...data,
      });
      setModal(false);
      reset();
      load(date);
    } finally { setLoading(false); }
  };

  const remove = async (id: string) => {
    await api.delete(`/planning/${id}`);
    load(date);
  };

  const overBudget = items.filter(i => i.status === 'over');
  const diff = totals.totalRealized - totals.totalPlanned;

  const chartData = items.map(i => ({
    category: i.category,
    Previsto: i.plannedValue,
    Realizado: i.realizedValue,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <MonthPicker date={date} onChange={setDate} />
        <button onClick={() => { reset(); setModal(true); }} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Adicionar Orçamento
        </button>
      </div>

      {/* Alert banner */}
      {overBudget.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Orçamento ultrapassado!</p>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
              {overBudget.map(i => i.category).join(', ')} — verifique seus gastos.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Previsto</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{fmt(totals.totalPlanned)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Realizado</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{fmt(totals.totalRealized)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-500 dark:text-gray-400">Diferença</p>
          <div className="flex items-center gap-2 mt-1">
            {diff <= 0
              ? <CheckCircle className="w-5 h-5 text-emerald-500" />
              : <AlertTriangle className="w-5 h-5 text-red-500" />
            }
            <p className={`text-2xl font-bold ${diff <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {diff > 0 ? '+' : ''}{fmt(diff)}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm">Previsto vs Realizado</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="Previsto" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Realizado" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Categoria</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Previsto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Realizado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">%</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Progresso</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 dark:text-gray-600">Nenhum orçamento definido</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="table-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.status === 'over'
                        ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        : <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      }
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{item.category}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-gray-400">{fmt(item.plannedValue)}</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">{fmt(item.realizedValue)}</td>
                  <td className={`px-4 py-3 text-right text-sm font-bold ${item.status === 'over' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {item.overrunPercent}%
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 min-w-[80px]">
                      <div
                        className={`h-2 rounded-full transition-all ${item.status === 'over' ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, item.overrunPercent)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => remove(item.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Definir Orçamento" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Categoria</label>
            <select {...register('category', { required: true })} className="input">
              <option value="">Selecione...</option>
              {EXPENSE_CATEGORIES.filter(c => !items.find(i => i.category === c)).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Valor previsto (R$)</label>
            <input type="number" step="0.01" {...register('plannedValue', { required: true })} className="input" placeholder="0,00" />
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
