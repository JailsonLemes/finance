import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Target, PlusCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import api from '../services/api';
import Modal from '../components/Modal';
import { Goal, GOAL_CATEGORIES } from '../types';
import { fmt } from '../utils/fmt';

const GOAL_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6'];

type FormData = {
  title: string; description: string; targetValue: string;
  currentValue: string; targetDate: string; category: string; color: string;
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [modal, setModal] = useState(false);
  const [contributeModal, setContributeModal] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [selected, setSelected] = useState<Goal | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm<FormData>();

  const load = async () => {
    const { data } = await api.get('/goals');
    setGoals(data);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    reset({ color: '#6366f1', currentValue: '0' });
    setModal(true);
  };

  const openEdit = (goal: Goal) => {
    setEditing(goal);
    reset({
      title: goal.title,
      description: goal.description || '',
      targetValue: String(goal.targetValue),
      currentValue: String(goal.currentValue),
      targetDate: goal.targetDate ? format(new Date(goal.targetDate), 'yyyy-MM-dd') : '',
      category: goal.category,
      color: goal.color,
    });
    setModal(true);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      if (editing) {
        await api.put(`/goals/${editing.id}`, data);
      } else {
        await api.post('/goals', data);
      }
      setModal(false);
      load();
    } finally { setLoading(false); }
  };

  const contribute = async () => {
    if (!selected || !amount) return;
    try {
      setLoading(true);
      await api.patch(`/goals/${selected.id}/contribute`, { amount: parseFloat(amount) });
      setContributeModal(false);
      setAmount('');
      load();
    } finally { setLoading(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover meta?')) return;
    await api.delete(`/goals/${id}`);
    load();
  };

  const totalTarget = goals.reduce((s, g) => s + g.targetValue, 0);
  const totalCurrent = goals.reduce((s, g) => s + g.currentValue, 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{goals.length} meta{goals.length !== 1 ? 's' : ''} • Progresso geral: {overallProgress}%</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Meta
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="card p-16 text-center">
          <Target className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-600">Nenhuma meta cadastrada</p>
          <p className="text-sm text-gray-400 dark:text-gray-600 mt-1">Defina objetivos financeiros para o casal!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {goals.map(goal => (
            <div key={goal.id} className="card overflow-hidden">
              {/* Header */}
              <div className="p-1" style={{ background: goal.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: goal.color + '20' }}>
                      <Target className="w-4 h-4" style={{ color: goal.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{goal.title}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{goal.category}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(goal)} className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(goal.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {goal.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{goal.description}</p>
                )}

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500 dark:text-gray-400">{fmt(goal.currentValue)}</span>
                    <span className="font-semibold" style={{ color: goal.color }}>{goal.progressPercent}%</span>
                    <span className="text-gray-500 dark:text-gray-400">{fmt(goal.targetValue)}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full transition-all"
                      style={{ width: `${goal.progressPercent}%`, background: goal.color }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {goal.targetDate && (
                    <p className="text-xs text-gray-400">Até {format(new Date(goal.targetDate), 'MMM/yyyy')}</p>
                  )}
                  <button
                    onClick={() => { setSelected(goal); setAmount(''); setContributeModal(true); }}
                    className="ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: goal.color + '20', color: goal.color }}
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Contribuir
                  </button>
                </div>

                {goal.progressPercent >= 100 && (
                  <div className="mt-3 text-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold py-1.5 rounded-xl">
                    🎉 Meta alcançada!
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Goal Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Meta' : 'Nova Meta'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Título</label>
            <input {...register('title', { required: true })} className="input" placeholder="Ex: Viagem para Europa" />
          </div>
          <div>
            <label className="label">Descrição (opcional)</label>
            <input {...register('description')} className="input" placeholder="Detalhes da meta..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor objetivo (R$)</label>
              <input type="number" step="0.01" {...register('targetValue', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">Valor atual (R$)</label>
              <input type="number" step="0.01" {...register('currentValue')} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select {...register('category', { required: true })} className="input">
                <option value="">Selecione...</option>
                {GOAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Data objetivo</label>
              <input type="date" {...register('targetDate')} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {GOAL_COLORS.map(c => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" {...register('color')} value={c} className="sr-only" />
                  <div className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 shadow" style={{ background: c }} />
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Contribute Modal */}
      <Modal open={contributeModal} onClose={() => setContributeModal(false)} title={`Contribuir: ${selected?.title}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Progresso atual: <strong>{fmt(selected?.currentValue || 0)}</strong> de <strong>{fmt(selected?.targetValue || 0)}</strong>
          </p>
          <div>
            <label className="label">Valor a adicionar (R$)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="input"
              placeholder="0,00"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setContributeModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={contribute} disabled={loading || !amount} className="btn-primary flex-1 disabled:opacity-60">
              {loading ? 'Salvando...' : 'Contribuir'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
