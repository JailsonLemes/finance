import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Download } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import api from '../services/api';
import Modal from '../components/Modal';
import MonthPicker from '../components/MonthPicker';
import { Bill, BILL_CATEGORIES } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { fmt } from '../utils/fmt';

type FormData = {
  description: string; value: string; dueDate: string;
  category: string; responsible: string; recurrent: boolean;
};

const statusBadge = (status: Bill['status']) => ({
  paid: 'badge-paid',
  pending: 'badge-pending',
  overdue: 'badge-overdue',
}[status]);

const statusLabel = { paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado' };

function billStatus(bill: Pick<Bill, 'paid' | 'dueDate'>): Bill['status'] {
  if (bill.paid) return 'paid';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(bill.dueDate); due.setHours(0, 0, 0, 0);
  return due < today ? 'overdue' : 'pending';
}

function calcTotals(list: Bill[]) {
  return {
    total:   list.reduce((s, b) => s + b.value, 0),
    paid:    list.filter(b => b.status === 'paid').reduce((s, b) => s + b.value, 0),
    pending: list.filter(b => b.status === 'pending').reduce((s, b) => s + b.value, 0),
    overdue: list.filter(b => b.status === 'overdue').reduce((s, b) => s + b.value, 0),
  };
}

export default function BillsPage() {
  const { user } = useAuth();
  const [items, setItems]           = useState<Bill[]>([]);
  const [date, setDate]             = useState(new Date());
  const [filter, setFilter]         = useState<string>('all');
  const [modal, setModal]           = useState(false);
  const [editing, setEditing]       = useState<Bill | null>(null);
  const [loading, setLoading]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null);
  const { register, handleSubmit, reset } = useForm<FormData>();

  const totals = calcTotals(items);

  const load = async (d: Date) => {
    const { data } = await api.get('/bills', {
      params: { month: d.getMonth() + 1, year: d.getFullYear() },
    });
    setItems(data.items);
  };

  useEffect(() => { load(date); }, [date]);

  const toggle = async (id: string) => {
    setItems(prev => prev.map(b => {
      if (b.id !== id) return b;
      const paid = !b.paid;
      const status = billStatus({ paid, dueDate: b.dueDate });
      return { ...b, paid, status, paidAt: paid ? new Date().toISOString() : undefined };
    }));
    try {
      await api.patch(`/bills/${id}/toggle`);
    } finally {
      await load(date);
    }
  };

  const openNew = () => {
    setEditing(null);
    reset({ dueDate: format(new Date(), 'yyyy-MM-dd'), responsible: 'partner1', recurrent: false });
    setModal(true);
  };

  const openEdit = (item: Bill) => {
    setEditing(item);
    reset({
      description: item.description,
      value:       String(item.value),
      dueDate:     format(new Date(item.dueDate), 'yyyy-MM-dd'),
      category:    item.category,
      responsible: item.responsible,
      recurrent:   item.recurrent,
    });
    setModal(true);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      if (editing) {
        await api.put(`/bills/${editing.id}`, data);
      } else {
        await api.post('/bills', data);
      }
      setModal(false);
      load(date);
    } finally { setLoading(false); }
  };

  const doDelete = async (bill: Bill) => {
    setDeleteTarget(null);
    await api.delete(`/bills/${bill.id}`);
    load(date);
  };

  const exportXLSX = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(filtered.map(b => ({
      Descrição:   b.description,
      Valor:       b.value,
      Vencimento:  format(new Date(b.dueDate), 'dd/MM/yyyy'),
      Categoria:   b.category,
      Responsável: b.responsible,
      Status:      statusLabel[b.status],
      'Pago Em':   b.paidAt ? format(new Date(b.paidAt), 'dd/MM/yyyy') : '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contas');
    XLSX.writeFile(wb, `contas-${format(date, 'MM-yyyy')}.xlsx`);
  };

  const filtered = filter === 'all' ? items : items.filter(b => b.status === filter);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <MonthPicker date={date} onChange={setDate} />
        <div className="flex gap-2">
          <button onClick={exportXLSX} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova Conta
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'all',     label: 'Total',      value: totals.total,   textColor: 'text-gray-700 dark:text-gray-300' },
          { key: 'paid',    label: 'Pagas',      value: totals.paid,    textColor: 'text-emerald-700 dark:text-emerald-400' },
          { key: 'pending', label: 'Pendentes',  value: totals.pending, textColor: 'text-amber-700 dark:text-amber-400' },
          { key: 'overdue', label: 'Atrasadas',  value: totals.overdue, textColor: 'text-red-700 dark:text-red-400' },
        ].map(({ key, label, value, textColor }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`card p-4 text-left transition-all hover:shadow-md ${filter === key ? 'ring-2 ring-primary-500' : ''}`}
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className={`text-lg font-bold mt-1 truncate ${textColor}`}>{fmt(value)}</p>
          </button>
        ))}
      </div>

      {/* Bills list */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="w-10 px-4 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Descrição</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Vencimento</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Valor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400 dark:text-gray-600">Nenhuma conta encontrada</td></tr>
              ) : filtered.map(bill => (
                <tr key={bill.id} className={`table-row ${bill.status === 'paid' ? 'opacity-70' : ''}`}>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(bill.id)}
                      aria-label={bill.paid ? 'Marcar como pendente' : 'Marcar como pago'}
                      className="transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                    >
                      {bill.paid
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        : <Circle className={`w-5 h-5 ${bill.status === 'overdue' ? 'text-red-400' : 'text-gray-300 dark:text-gray-600'}`} />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <p className={`text-sm font-medium ${bill.paid ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                      {bill.description}
                    </p>
                    {bill.recurrent && <span className="text-xs text-gray-400">Recorrente</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden md:table-cell">
                    {format(new Date(bill.dueDate), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-lg text-xs text-gray-600 dark:text-gray-400">
                      {bill.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`badge ${statusBadge(bill.status)}`}>
                      {statusLabel[bill.status]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right text-sm font-semibold
                    ${bill.status === 'overdue' ? 'text-red-600 dark:text-red-400' :
                      bill.status === 'paid'    ? 'text-emerald-600 dark:text-emerald-400' :
                                                  'text-amber-600 dark:text-amber-400'}`}>
                    {fmt(bill.value)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(bill)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(bill)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
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

      {/* Modal: cadastro/edição */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Conta' : 'Nova Conta'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Descrição</label>
            <input {...register('description', { required: true })} className="input" placeholder="Ex: Aluguel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$)</label>
              <input type="number" step="0.01" {...register('value', { required: true })} className="input" placeholder="0,00" />
            </div>
            <div>
              <label className="label">Vencimento</label>
              <input type="date" {...register('dueDate', { required: true })} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select {...register('category', { required: true })} className="input">
                <option value="">Selecione...</option>
                {BILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Responsável</label>
              <select {...register('responsible')} className="input">
                <option value="partner1">{user?.name}</option>
                {user?.partnerName && <option value="partner2">{user.partnerName}</option>}
                <option value="both">Ambos</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('recurrent')} className="rounded" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Conta recorrente</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-60">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: confirmação de exclusão */}
      {deleteTarget && (
        <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remover conta">
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Confirma a remoção de <strong>{deleteTarget.description}</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => doDelete(deleteTarget)}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                Remover
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
