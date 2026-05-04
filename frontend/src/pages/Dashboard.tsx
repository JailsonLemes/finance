import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Wallet, Clock, AlertTriangle,
  Target, BarChart3, RefreshCw,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import api from '../services/api';
import StatCard from '../components/StatCard';
import MonthPicker from '../components/MonthPicker';
import { DashboardData } from '../types';
import { fmt } from '../utils/fmt';
import { CHART_COLORS } from '../utils/colors';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (d: Date) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/dashboard', {
        params: { month: d.getMonth() + 1, year: d.getFullYear() },
      });
      setData(res.data);
    } catch {
      setError('Erro ao carregar dados. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(date); }, [date]);

  const pieData = data
    ? Object.entries(data.expensesByCategory)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    : [];

  const healthColor =
    !data ? 'gray' :
    data.healthScore >= 70 ? 'emerald' :
    data.healthScore >= 40 ? 'amber' : 'red';

  const healthLabel =
    !data ? '' :
    data.healthScore >= 70 ? 'Ótima' :
    data.healthScore >= 40 ? 'Regular' : 'Atenção';

  const yAxisFormatter = (v: number) => {
    if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `R$${(v / 1_000).toFixed(0)}k`;
    return `R$${v}`;
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Resumo Financeiro</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Visão geral das finanças do casal</p>
        </div>
        <MonthPicker date={date} onChange={d => { setDate(d); }} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="card p-10 flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500" />
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => load(date)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      ) : data && (
        <>
          {/* Saúde financeira */}
          <div className={`card p-5 border-l-4 ${healthColor === 'emerald' ? 'border-emerald-500' : healthColor === 'amber' ? 'border-amber-500' : 'border-red-500'}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Saúde Financeira</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{healthLabel} — {data.healthScore}%</p>
              </div>
              <div className="flex-1 max-w-xs">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${healthColor === 'emerald' ? 'bg-emerald-500' : healthColor === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${data.healthScore}%` }}
                  />
                </div>
              </div>
              {data.overdueBills > 0 && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-xl text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  {data.overdueBills} conta{data.overdueBills > 1 ? 's' : ''} atrasada{data.overdueBills > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Stats grid — row 1 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Saldo do Mês"
              value={fmt(data.balance)}
              icon={Wallet}
              color={data.balance >= 0 ? 'green' : 'red'}
            />
            <StatCard
              title="Total de Receitas"
              value={fmt(data.totalIncome)}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              title="Total de Despesas"
              value={fmt(data.totalExpenses)}
              icon={TrendingDown}
              color="red"
            />
            <StatCard
              title="Contas Pendentes"
              value={fmt(data.totalPending)}
              icon={Clock}
              color="amber"
              subtitle={`Pagas: ${fmt(data.totalPaid)}`}
            />
          </div>

          {/* Stats grid — row 2 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Total Investido"
              value={fmt(data.totalInvested)}
              icon={BarChart3}
              color="indigo"
            />
            <StatCard
              title="Progresso das Metas"
              value={`${data.goalsProgress}%`}
              icon={Target}
              color="purple"
            />
            <StatCard
              title="Contas Atrasadas"
              value={String(data.overdueBills)}
              icon={AlertTriangle}
              color={data.overdueBills > 0 ? 'red' : 'green'}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie chart */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Despesas por Categoria</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-600">
                  Nenhuma despesa neste mês
                </div>
              )}
            </div>

            {/* Line chart */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Evolução nos Últimos 6 Meses</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.monthlyEvolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={yAxisFormatter} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="income" name="Receitas" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expenses" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
