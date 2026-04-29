import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Download } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import Modal from '../components/Modal';
import MonthPicker from '../components/MonthPicker';
import { Expense, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { fmt } from '../utils/fmt';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4','#a855f7'];

type FormData = {
  date: string; description: string; category: string; subcategory: string;
  value: string; person: string; paymentMethod: string; dueDate: string; cardId: string;
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [byCategory, setByCategory] = useState<Record<string, number>>({});
  const [date, setDate] = useState(new Date());
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<{ id: string; name: string }[]>([]);
  const { register, handleSubmit, reset, watch } = useForm<FormData>();
  const paymentMethod = watch('paymentMethod');

  const load = async (d: Date) => {
    const [expRes, cardRes] = await Promise.all([
      api.get('/expenses', { params: { month: d.getMonth() + 1, year: d.getFullYear() } }),
      api.get('/cards'),
    ]);
    setItems(expRes.data.items);
    setTotal(expRes.data.total);
    setByCategory(expRes.data.byCategory);
    setCards(cardRes.data.map((c: any) => ({ id: c.id, name: c.name })));
  };

  useEffect(() => { load(date); }, [date]);

  const openNew = () => {
    setEditing(null);
    reset({ date: format(new Date(), 'yyyy-MM-dd'), person: 'partner1', paymentMethod: 'PIX' });
    setModal(true);
  };

  const openEdit = (item: Expense) => {
    setEditing(item);
    reset({
      date: format(new Date(item.date), 'yyyy-MM-dd'),
      description: item.description,
      category: item.category,
      subcategory: item.subcategory || '',
      value: String(item.value),
      person: item.person,
      paymentMethod: item.paymentMethod,
      dueDate: item.dueDate ? format(new Date(item.dueDate), 'yyyy-MM-dd') : '',
      cardId: item.cardId || '',
    });
    setModal(true);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      const payload = { ...data, dueDate: data.dueDate || null, cardId: data.cardId || null };
      if (editing) {
        await api.put(`/expenses/${editing.id}`, payload);
      } else {
        await api.post('/expenses', payload);
      }
      setModal(false);
      load(date);
    } finally { setLoading(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover despesa?')) return;
    await api.delete(`/expenses/${id}`);
    load(date);
  };

  const exportXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(items.map(i => ({
      Data: format(new Date(i.date), 'dd/MM/yyyy'),
      Descrição: i.description,
      Categoria: i.category,
      Subcategoria: i.subcategory || '',
      Valor: i.value,
      Pessoa: i.person,
      Pagamento: i.paymentMethod,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Despesas');
    XLSX.writeFile(wb, `despesas-${format(date, 'MM-yyyy')}.xlsx`);
  };

  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value }));

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
                        {item.card && <p className="text-xs text-gray-400">{item.card.name}</p>}
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
                          <button onClick={() => remove(item.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
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
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-3">
                {pieData.sort((a, b) => b.value - a.value).slice(0, 6).map(({ name, value }, i) => (
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
            <div className="h-40 flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">Sem dados</div>
          )}
        </div>
      </div>

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
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-60">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
