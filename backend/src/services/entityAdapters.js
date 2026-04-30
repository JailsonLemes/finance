const { format, parseISO } = require('date-fns');

// ─── Helpers de conversão ─────────────────────────────────────────────────────
const toDate = (d) => (d ? format(new Date(d), 'yyyy-MM-dd') : '');
const fromDate = (s) => {
  if (!s) return null;
  const str = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return parseISO(str);
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
};
const toNum = (n) => (n == null ? '' : Number(n));
const fromNum = (s) => {
  if (s === '' || s == null) return null;
  const n = parseFloat(String(s).replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : null;
};
const toBool = (b) => (b ? 'TRUE' : 'FALSE');
const fromBool = (s) => ['TRUE', 'SIM', '1'].includes(String(s ?? '').trim().toUpperCase());
const toDateTime = (d) => (d ? format(new Date(d), "yyyy-MM-dd'T'HH:mm:ss") : '');

// ─── Receitas ─────────────────────────────────────────────────────────────────
const incomesAdapter = {
  key: 'incomes', prismaModel: 'income', sheetTab: 'Receitas',
  headers: ['ID', 'Data', 'Descrição', 'Categoria', 'Valor', 'Tipo', 'Pessoa', 'Atualizado em'],
  toRow:   (i) => [i.id, toDate(i.date), i.description, i.category, toNum(i.value), i.type, i.person, toDateTime(i.updatedAt)],
  fromRow: (r) => ({ id: r[0]?.trim()||null, date: fromDate(r[1]), description:(r[2]||'').trim(), category:(r[3]||'').trim(), value:fromNum(r[4]), type:(r[5]||'fixed').trim(), person:(r[6]||'').trim() }),
  validate:(d) => !d.date?'Data inválida':!d.description?'Descrição obrigatória':!d.value||d.value<=0?'Valor inválido':null,
  fingerprint:(d) => [toDate(d.date),d.description,d.category,Number(d.value).toFixed(2),d.type,d.person].join('|'),
};

// ─── Despesas ─────────────────────────────────────────────────────────────────
const expensesAdapter = {
  key: 'expenses', prismaModel: 'expense', sheetTab: 'Despesas',
  headers: ['ID','Data','Descrição','Categoria','Subcategoria','Valor','Pessoa','Forma Pagamento','Vencimento','Cartão ID','Atualizado em'],
  toRow:   (e) => [e.id, toDate(e.date), e.description, e.category, e.subcategory||'', toNum(e.value), e.person, e.paymentMethod, toDate(e.dueDate), e.cardId||'', toDateTime(e.updatedAt)],
  fromRow: (r) => ({ id:r[0]?.trim()||null, date:fromDate(r[1]), description:(r[2]||'').trim(), category:(r[3]||'').trim(), subcategory:(r[4]||'').trim()||null, value:fromNum(r[5]), person:(r[6]||'').trim(), paymentMethod:(r[7]||'').trim(), dueDate:fromDate(r[8]), cardId:(r[9]||'').trim()||null }),
  validate:(d) => !d.date?'Data inválida':!d.description?'Descrição obrigatória':!d.value||d.value<=0?'Valor inválido':null,
  fingerprint:(d) => [toDate(d.date),d.description,d.category,d.subcategory||'',Number(d.value).toFixed(2),d.person,d.paymentMethod,toDate(d.dueDate)].join('|'),
};

// ─── Contas ───────────────────────────────────────────────────────────────────
const billsAdapter = {
  key: 'bills', prismaModel: 'bill', sheetTab: 'Contas',
  headers: ['ID','Descrição','Valor','Vencimento','Categoria','Responsável','Status','Pago?','Recorrente?','Atualizado em'],
  toRow:   (b) => [b.id, b.description, toNum(b.value), toDate(b.dueDate), b.category, b.responsible, b.status, toBool(b.paid), toBool(b.recurrent), toDateTime(b.updatedAt)],
  fromRow: (r) => ({ id:r[0]?.trim()||null, description:(r[1]||'').trim(), value:fromNum(r[2]), dueDate:fromDate(r[3]), category:(r[4]||'').trim(), responsible:(r[5]||'').trim(), status:(r[6]||'pending').trim(), paid:fromBool(r[7]), recurrent:fromBool(r[8]) }),
  validate:(d) => !d.description?'Descrição obrigatória':!d.dueDate?'Vencimento inválido':!d.value||d.value<=0?'Valor inválido':null,
  fingerprint:(d) => [d.description,Number(d.value).toFixed(2),toDate(d.dueDate),d.category,d.responsible,d.status,d.paid?'1':'0'].join('|'),
};

// ─── Investimentos ────────────────────────────────────────────────────────────
const investmentsAdapter = {
  key: 'investments', prismaModel: 'investment', sheetTab: 'Investimentos',
  headers: ['ID','Tipo','Descrição','Valor Investido','Valor Atual','Rentabilidade (%)','Data','Atualizado em'],
  toRow:   (i) => [i.id, i.type, i.description, toNum(i.investedValue), toNum(i.currentValue), toNum(i.profitability), toDate(i.date), toDateTime(i.updatedAt)],
  fromRow: (r) => ({ id:r[0]?.trim()||null, type:(r[1]||'').trim(), description:(r[2]||'').trim(), investedValue:fromNum(r[3]), currentValue:fromNum(r[4]), profitability:fromNum(r[5])??0, date:fromDate(r[6]) }),
  validate:(d) => !d.type?'Tipo obrigatório':!d.description?'Descrição obrigatória':d.investedValue==null?'Valor investido inválido':!d.date?'Data inválida':null,
  fingerprint:(d) => [d.type,d.description,Number(d.investedValue).toFixed(2),Number(d.currentValue??d.investedValue).toFixed(2),toDate(d.date)].join('|'),
};

// ─── Metas ────────────────────────────────────────────────────────────────────
const goalsAdapter = {
  key: 'goals', prismaModel: 'goal', sheetTab: 'Metas',
  headers: ['ID','Título','Descrição','Valor Alvo','Valor Atual','Data Alvo','Categoria','Cor','Atualizado em'],
  toRow:   (g) => [g.id, g.title, g.description||'', toNum(g.targetValue), toNum(g.currentValue), toDate(g.targetDate), g.category, g.color||'#6366f1', toDateTime(g.updatedAt)],
  fromRow: (r) => ({ id:r[0]?.trim()||null, title:(r[1]||'').trim(), description:(r[2]||'').trim()||null, targetValue:fromNum(r[3]), currentValue:fromNum(r[4])??0, targetDate:fromDate(r[5]), category:(r[6]||'').trim(), color:(r[7]||'#6366f1').trim() }),
  validate:(d) => !d.title?'Título obrigatório':!d.targetValue||d.targetValue<=0?'Valor alvo inválido':null,
  fingerprint:(d) => [d.title,d.description||'',Number(d.targetValue).toFixed(2),Number(d.currentValue??0).toFixed(2),toDate(d.targetDate),d.category].join('|'),
};

const ALL_ADAPTERS = [incomesAdapter, expensesAdapter, billsAdapter, investmentsAdapter, goalsAdapter];

module.exports = { ALL_ADAPTERS, incomesAdapter, expensesAdapter, billsAdapter, investmentsAdapter, goalsAdapter };
