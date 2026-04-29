import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import IncomePage from './pages/Income';
import ExpensesPage from './pages/Expenses';
import BillsPage from './pages/Bills';
import CardsPage from './pages/Cards';
import InvestmentsPage from './pages/Investments';
import GoalsPage from './pages/Goals';
import PlanningPage from './pages/Planning';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="receitas" element={<IncomePage />} />
        <Route path="despesas" element={<ExpensesPage />} />
        <Route path="contas" element={<BillsPage />} />
        <Route path="cartoes" element={<CardsPage />} />
        <Route path="investimentos" element={<InvestmentsPage />} />
        <Route path="metas" element={<GoalsPage />} />
        <Route path="planejamento" element={<PlanningPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
