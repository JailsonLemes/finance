import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Download } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import api from '../services/api';
import Modal from '../components/Modal';
import MonthPicker from '../components/MonthPicker';
import { Income, INCOME_CATEGORIES } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { fmt } from '../utils/fmt';

type FormData = {
  date: string; description: string; category: string;
  value: string; type: string; person: string;
};

export default function IncomePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Income[]>([]);
  const [total, setTotal] = useState(0);
  const [date, setDate] = useState(new Date());
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, setValue } = useForm<FormData>();

  const load = async (d: Date) => {
    const { data } = await api.get('/incomes', { params: { month: d.getMonth() + 1, year: d.getFullYear() } });
    setItems(data.items);
    setTotal(data.total);
  };

  useEffect(() => { load(date); }, [date]);

  const openNew = () => {
    setEditing(null);
    reset({ date: format(new Date(), 'yyyy-MM-dd'), type: 'fixed', person: 'partner1' });
    setModal(true);
  };

  const openEdit = (item: Income) => {
    setEditing(item);
    reset({
      date: format(new Date(item.date), 'yyyy-MM-dd'),
      description: item.description,
      category: item.category,
      value: String(item.value),
      type: item.type,
      person: item.person,
    });
    setModal(true);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      if (editing) {
        await api.put(`/incomes/${editing.id}`, data);
      } else {
        await api.post('/incomes', data);
      }
      setModal(false);
      load(date);
    } finally { setLoading(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover receita?')) return;
    await api.delete(`/incomes/${id}`);
    load(date);
  };

  const exportXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(items.map(i => ({
      Data: format(new Date(i.date), 'dd/MM/yyyy'),
      Descrição: i.description,
      Categoria: i.category,
      Tipo: i.type === 'fixed' ? 'Fixa' : 'Variável',
      Pessoa: i.person === 'partner1' ? user?.name : i.person === 'partner2' ? user?.partnerName : 'Ambos',
      Valor: i.value,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Receitas');
    XLSX.writeFile(wb, `receitas-${format(date, 'MM-yyyy')}.xlsx`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <MonthPicker date={date} onChange={setDate} />
        <div className="flex gap-2">
          <button onClick={exportXLSX} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Receita
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="card p-4 flex items-center justify-between">
        <span className="text-gray-600 dark:text-gray-400 text-sm">{items.length} receita{items.length !== 1 ? 's' : ''} no período</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg">{fmt(total)}</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Data</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden md:table-cell">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide hidden lg:table-cell">Pessoa</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Valor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 dark:text-gray-600">Nenhuma receita neste período</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="table-row">
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{format(new Date(item.date), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-lg text-xs">{item.category}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-lg ${item.type === 'fixed' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'}`}>
                      {item.type === 'fixed' ? 'Fixa' : 'Variável'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                    {item.person === 'partner1' ? user?.name : item.person === 'partner2' ? user?.partnerName : 'Ambos'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-emerald-600 dark:text-emerald-400">{fmt(item.value)}</td>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Receita' : 'Nova Receita'}>
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
            <input {...register('description', { required: true })} className="input" placeholder="Ex: Salário" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select {...register('category', { required: true })} className="input">
                <option value="">Selecione...</option>
                {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo</label>
              <select {...register('type')} className="input">
                <option value="fixed">Fixa</option>
                <option value="variable">Variável</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Pessoa</label>
            <select {...register('person')} className="input">
              <option value="partner1">{user?.name}</option>
              {user?.partnerName && <option value="partner2">{user.partnerName}</option>}
              <option value="both">Ambos</option>
            </select>
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
