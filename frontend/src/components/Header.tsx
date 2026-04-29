import { Menu, Moon, Sun, LogOut, Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/receitas': 'Receitas',
  '/despesas': 'Despesas',
  '/contas': 'Contas a Pagar',
  '/cartoes': 'Cartões de Crédito',
  '/investimentos': 'Investimentos',
  '/metas': 'Metas Financeiras',
  '/planejamento': 'Planejamento',
};

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-4">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="flex-1 font-semibold text-gray-900 dark:text-white text-lg">
        {titles[pathname] || 'FinCouple'}
      </h1>

      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          title={dark ? 'Modo claro' : 'Modo escuro'}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
          <div className="w-7 h-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <span className="hidden md:block text-sm text-gray-700 dark:text-gray-300 font-medium">{user?.name}</span>
        </div>

        <button
          onClick={logout}
          className="p-2 rounded-xl text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
