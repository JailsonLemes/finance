import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Heart, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'login' | 'register';

interface LoginForm { email: string; password: string; }
interface RegisterForm { email: string; password: string; name: string; partnerName: string; }

export default function Login() {
  const [tab, setTab] = useState<Tab>('login');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const loginForm = useForm<LoginForm>();
  const registerForm = useForm<RegisterForm>();

  const onLogin = async (data: LoginForm) => {
    try {
      setError(''); setLoading(true);
      await login(data.email, data.password);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao fazer login');
    } finally { setLoading(false); }
  };

  const onRegister = async (data: RegisterForm) => {
    try {
      setError(''); setLoading(true);
      await register(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao criar conta');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-primary-600 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-primary-200 dark:shadow-primary-900/50">
            <Heart className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">FinCouple</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Controle financeiro do casal</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          {/* Tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 mb-6">
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === t ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
              >
                {t === 'login' ? 'Entrar' : 'Criar Conta'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  {...loginForm.register('email', { required: true })}
                  type="email"
                  className="input"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="label">Senha</label>
                <div className="relative">
                  <input
                    {...loginForm.register('password', { required: true })}
                    type={showPass ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 disabled:opacity-60">
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
              <p className="text-center text-sm text-gray-400">
                Demo: <strong>demo@fincouple.com</strong> / <strong>demo123</strong>
              </p>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Seu nome</label>
                  <input {...registerForm.register('name', { required: true })} className="input" placeholder="João" />
                </div>
                <div>
                  <label className="label">Nome do(a) parceiro(a)</label>
                  <input {...registerForm.register('partnerName')} className="input" placeholder="Maria" />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input {...registerForm.register('email', { required: true })} type="email" className="input" placeholder="casal@email.com" />
              </div>
              <div>
                <label className="label">Senha</label>
                <div className="relative">
                  <input
                    {...registerForm.register('password', { required: true, minLength: 8 })}
                    type={showPass ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 disabled:opacity-60">
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
