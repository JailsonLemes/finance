export interface User {
  id: string;
  email: string;
  name: string;
  partnerName?: string;
  darkMode: boolean;
}

export interface Income {
  id: string;
  date: string;
  description: string;
  category: string;
  value: number;
  type: 'fixed' | 'variable';
  person: 'partner1' | 'partner2' | 'both';
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  category: string;
  subcategory?: string;
  value: number;
  person: string;
  paymentMethod: string;
  dueDate?: string;
  cardId?: string;
  card?: { name: string; color: string };
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  installmentGroupId?: string | null;
}

export interface Bill {
  id: string;
  description: string;
  value: number;
  dueDate: string;
  category: string;
  responsible: string;
  status: 'paid' | 'pending' | 'overdue';
  paid: boolean;
  paidAt?: string;
  recurrent: boolean;
}

export interface Card {
  id: string;
  name: string;
  cardLimit: number;
  closingDay: number;
  dueDay: number;
  color: string;
  invoiceTotal: number;
  usedLimit: number;
  availableLimit: number;
  currentExpenses: Expense[];
  currentInstallments: Installment[];
}

export interface Installment {
  id: string;
  cardId: string;
  description: string;
  totalValue: number;
  installmentValue: number;
  totalInstallments: number;
  currentInstallment: number;
  date: string;
}

export interface Investment {
  id: string;
  type: string;
  description: string;
  investedValue: number;
  currentValue: number;
  profitability: number;
  date: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  targetValue: number;
  currentValue: number;
  targetDate?: string;
  category: string;
  color: string;
  progressPercent: number;
}

export interface Planning {
  id: string;
  month: number;
  year: number;
  category: string;
  plannedValue: number;
  realizedValue: number;
  status: 'ok' | 'over';
  overrunPercent: number;
}

export interface DashboardData {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  totalPaid: number;
  totalPending: number;
  expensesByCategory: Record<string, number>;
  monthlyEvolution: { month: string; income: number; expenses: number }[];
  healthScore: number;
  totalInvested: number;
  goalsProgress: number;
  overdueBills: number;
}

export const INCOME_CATEGORIES = [
  'Salário', 'Freelance', 'Investimentos', 'Aluguel', 'Bônus', 'Outros',
];

export const EXPENSE_CATEGORIES = [
  'Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação',
  'Lazer', 'Vestuário', 'Beleza', 'Tecnologia', 'Viagem', 'Pets',
  'Pessoal', 'Financiamentos', 'Outros',
];

export const PAYMENT_METHODS = [
  'Dinheiro', 'Débito', 'Crédito', 'PIX', 'Transferência', 'Boleto',
];

export const INVESTMENT_TYPES = [
  { value: 'fixed_income', label: 'Renda Fixa' },
  { value: 'stocks', label: 'Ações' },
  { value: 'real_estate', label: 'FII' },
  { value: 'crypto', label: 'Cripto' },
  { value: 'savings', label: 'Poupança' },
  { value: 'other', label: 'Outros' },
];

export const GOAL_CATEGORIES = [
  'Viagem', 'Imóvel', 'Carro', 'Reserva de Emergência', 'Educação', 'Casamento', 'Outros',
];

export const BILL_CATEGORIES = [
  'Moradia', 'Saúde', 'Educação', 'Serviços', 'Seguros', 'Financiamentos', 'Outros',
];
