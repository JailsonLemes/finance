import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, TrendingUp, TrendingDown, FileText,
  CreditCard, BarChart3, Target, PieChart, X, Heart, Zap, Upload,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const nav = [
  { to: '/',              label: 'Dashboard',      icon: LayoutDashboard, exact: true },
  { to: '/receitas',      label: 'Receitas',        icon: TrendingUp },
  { to: '/despesas',      label: 'Despesas',        icon: TrendingDown },
  { to: '/contas',        label: 'Contas a Pagar',  icon: FileText },
  { to: '/cartoes',       label: 'Cartões',         icon: CreditCard },
  { to: '/investimentos', label: 'Investimentos',   icon: BarChart3 },
  { to: '/metas',         label: 'Metas',           icon: Target },
  { to: '/planejamento',  label: 'Planejamento',    icon: PieChart },
  { to: '/integracoes',   label: 'Integrações',     icon: Zap, badge: 'NEW' },
  { to: '/importar',      label: 'Importar XLSX',   icon: Upload },
];

interface Props { open: boolean; onClose: () => void; }

export default function Sidebar({ open, onClose }: Props) {
  const { user } = useAuth();

  return (
    <>
      {/* Backdrop — always rendered, fades in/out to match sidebar transition */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-200
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
        w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
        flex flex-col transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-xl flex items-center justify-center">
              <Heart className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white">FinCouple</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar menu"
            className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="mx-4 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400">Casal</p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
            {user?.name}{user?.partnerName ? ` & ${user.partnerName}` : ''}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, exact, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                 ${isActive
                   ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                   : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                 }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-600 text-white font-semibold">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-600">
          FinCouple v1.1
        </div>
      </aside>
    </>
  );
}
