import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import api from '../services/api';
import Modal from '../components/Modal';
import { Card } from '../types';
import { fmt } from '../utils/fmt';

type CardForm = { name: string; cardLimit: string; closingDay: string; dueDay: string; color: string; };
type InstallmentForm = { description: string; totalValue: string; totalInstallments: string; date: string; };

const CARD_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6'];

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [modal, setModal] = useState(false);
  const [installModal, setInstallModal] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm<CardForm>();
  const installForm = useForm<InstallmentForm>();

  const load = async () => {
    const { data } = await api.get('/cards');
    setCards(data);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    reset({ color: '#6366f1', closingDay: '1', dueDay: '10' });
    setModal(true);
  };

  const openEdit = (card: Card) => {
    setEditing(card);
    reset({
      name: card.name,
      cardLimit: String(card.cardLimit),
      closingDay: String(card.closingDay),
      dueDay: String(card.dueDay),
      color: card.color,
    });
    setModal(true);
  };

  const onSubmit = async (data: CardForm) => {
    try {
      setLoading(true);
      if (editing) {
        await api.put(`/cards/${editing.id}`, data);
      } else {
        await api.post('/cards', data);
      }
      setModal(false);
      load();
    } finally { setLoading(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remover cartão e todos os dados?')) return;
    await api.delete(`/cards/${id}`);
    load();
  };

  const onInstallment = async (data: InstallmentForm) => {
    try {
      setLoading(true);
      await api.post(`/cards/${selectedCard!.id}/installments`, data);
      setInstallModal(false);
      installForm.reset();
      load();
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{cards.length} cartão(ões) cadastrado(s)</p>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Novo Cartão
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="card p-16 text-center">
          <CreditCard className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-600">Nenhum cartão cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cards.map(card => (
            <div key={card.id} className="card overflow-hidden">
              {/* Card visual */}
              <div className="p-5 text-white relative overflow-hidden" style={{ background: card.color }}>
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
                <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/10" />
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <p className="text-sm font-medium opacity-80">Cartão</p>
                    <p className="text-xl font-bold mt-0.5">{card.name}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(card)} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(card.id)} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex justify-between items-end relative z-10">
                  <div>
                    <p className="text-xs opacity-70">Fatura atual</p>
                    <p className="text-2xl font-bold">{fmt(card.invoiceTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-70">Limite disponível</p>
                    <p className="text-sm font-semibold">{fmt(card.availableLimit)}</p>
                  </div>
                </div>
                {/* Limit bar */}
                <div className="mt-3 relative z-10">
                  <div className="w-full bg-white/20 rounded-full h-1.5">
                    <div
                      className="bg-white rounded-full h-1.5 transition-all"
                      style={{ width: `${Math.min(100, (card.usedLimit / card.cardLimit) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs opacity-70 mt-1">
                    {fmt(card.usedLimit)} / {fmt(card.cardLimit)} ({((card.usedLimit / card.cardLimit) * 100).toFixed(0)}%)
                  </p>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Fecha dia {card.closingDay}</span>
                  <span>Vence dia {card.dueDay}</span>
                </div>

                {/* Recent expenses */}
                {card.currentExpenses.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Lançamentos</p>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {card.currentExpenses.slice(0, 5).map(e => (
                        <div key={e.id} className="flex justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400 truncate flex-1">{e.description}</span>
                          <span className="text-red-600 dark:text-red-400 font-medium ml-2">{fmt(e.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Installments */}
                {card.currentInstallments.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Parcelas</p>
                    <div className="space-y-1.5">
                      {card.currentInstallments.slice(0, 3).map(i => (
                        <div key={i.id} className="flex justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                            {i.description} ({i.currentInstallment}/{i.totalInstallments})
                          </span>
                          <span className="text-orange-600 dark:text-orange-400 font-medium ml-2">{fmt(i.installmentValue)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setSelectedCard(card); installForm.reset({ date: format(new Date(), 'yyyy-MM-dd'), totalInstallments: '1' }); setInstallModal(true); }}
                  className="w-full btn-secondary text-xs py-1.5"
                >
                  + Parcelamento
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Card Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Cartão' : 'Novo Cartão'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Nome do Cartão</label>
            <input {...register('name', { required: true })} className="input" placeholder="Ex: Nubank, Inter..." />
          </div>
          <div>
            <label className="label">Limite (R$)</label>
            <input type="number" step="0.01" {...register('cardLimit', { required: true })} className="input" placeholder="5000,00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Dia de fechamento</label>
              <input type="number" min="1" max="31" {...register('closingDay', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">Dia de vencimento</label>
              <input type="number" min="1" max="31" {...register('dueDay', { required: true })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CARD_COLORS.map(c => (
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

      {/* Installment Modal */}
      <Modal open={installModal} onClose={() => setInstallModal(false)} title="Adicionar Parcelamento" size="sm">
        <form onSubmit={installForm.handleSubmit(onInstallment)} className="space-y-4">
          <div>
            <label className="label">Descrição</label>
            <input {...installForm.register('description', { required: true })} className="input" placeholder="Ex: TV 50 polegadas" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor total (R$)</label>
              <input type="number" step="0.01" {...installForm.register('totalValue', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">Nº de parcelas</label>
              <input type="number" min="1" {...installForm.register('totalInstallments', { required: true })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Data da 1ª parcela</label>
            <input type="date" {...installForm.register('date', { required: true })} className="input" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setInstallModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
