import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import api from '../services/api';

// Colunas dos meses na planilha (índice 0): col 2=Jan ... col 13=Dez
const MONTH_COLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const SECTION_MAP: { match: string; type: 'income' | 'expense' | 'investment'; category: string }[] = [
  { match: 'RENDA',             type: 'income',     category: 'Salário' },
  { match: 'CASA',              type: 'expense',    category: 'Moradia' },
  { match: 'SAÚDE',             type: 'expense',    category: 'Saúde' },
  { match: 'IMPOSTOS',          type: 'expense',    category: 'Financiamentos' },
  { match: 'EMPRESTIMO',        type: 'expense',    category: 'Financiamentos' },
  { match: 'CARRO',             type: 'expense',    category: 'Transporte' },
  { match: 'MOTO',              type: 'expense',    category: 'Transporte' },
  { match: 'DESPESAS PESSOAIS', type: 'expense',    category: 'Pessoal' },
  { match: 'LAZER',             type: 'expense',    category: 'Lazer' },
  { match: 'INVESTIMENTO',      type: 'investment', category: 'savings' },
  { match: 'DEPENDENTE',        type: 'expense',    category: 'Educação' },
];

interface ParsedRecord {
  type: 'income' | 'expense' | 'investment';
  month: number;
  description: string;
  value: number;
  category: string;
  person?: string;
}

interface MonthSummary {
  month: number;
  incomes: number;
  expenses: number;
  investments: number;
  hasData: boolean;
  hasExisting: boolean; // já existe no banco
}

function detectPerson(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes('giovanna') || d.includes('gio') || d.includes('cleosa')) return 'partner2';
  if (d.includes('jailson')) return 'partner1';
  return 'both';
}

function detectIncomeCategory(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes('salário') || d.includes('salario')) return 'Salário';
  if (d.includes('plr') || d.includes('bônus') || d.includes('bonus') || d.includes('13')) return 'Bônus';
  if (d.includes('vale')) return 'Outros';
  return 'Salário';
}

function parseSpreadsheet(wb: XLSX.WorkBook): ParsedRecord[] {
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('orçamento') || n.toLowerCase().includes('orcamento'))
    ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as (string | number | null)[][];

  const records: ParsedRecord[] = [];
  let currentType: 'income' | 'expense' | 'investment' | null = null;
  let currentCategory = '';
  let done = false;

  for (const row of rows) {
    if (done || !row || !row.some(v => v !== null)) continue;

    const col0 = row[0];
    const col1 = row[1];

    if (col0 && typeof col0 === 'string' && col0.trim()) {
      const name = col0.trim().toUpperCase();
      const match = SECTION_MAP.find(s => name.includes(s.match));
      if (match) {
        currentType = match.type;
        currentCategory = match.category;
      } else {
        currentType = null;
      }
      continue;
    }

    if (currentType && col0 === null && col1 && typeof col1 === 'string' && col1.trim()) {
      const desc = col1.trim();
      const hasStringInMonthCols = MONTH_COLS.some(i => typeof row[i] === 'string');
      if (hasStringInMonthCols || desc.toUpperCase() === 'TOTAIS' || desc.toUpperCase().startsWith('RESUMO')) {
        done = true;
        continue;
      }

      MONTH_COLS.forEach((colIdx, monthIdx) => {
        const rawValue = row[colIdx];
        const value = typeof rawValue === 'number' ? rawValue : 0;
        if (value <= 0) return;

        records.push({
          type: currentType!,
          month: monthIdx,
          description: desc,
          value,
          category: currentType === 'income' ? detectIncomeCategory(desc) : currentCategory,
          person: currentType === 'income' ? detectPerson(desc) : 'both',
        });
      });
    }
  }

  return records;
}

function buildSummary(records: ParsedRecord[], existingMonths: Set<number>): MonthSummary[] {
  return MONTH_NAMES.map((_, i) => {
    const month = records.filter(r => r.month === i);
    return {
      month: i,
      incomes:      month.filter(r => r.type === 'income').length,
      expenses:     month.filter(r => r.type === 'expense').length,
      investments:  month.filter(r => r.type === 'investment').length,
      hasData:      month.length > 0,
      hasExisting:  existingMonths.has(i),
    };
  });
}

type Status = 'idle' | 'checking' | 'parsed' | 'importing' | 'done' | 'error';

export default function ImportPage() {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [year, setYear]           = useState(new Date().getFullYear());
  const [records, setRecords]     = useState<ParsedRecord[]>([]);
  const [summary, setSummary]     = useState<MonthSummary[]>([]);
  const [selected, setSelected]   = useState<number[]>([]);
  const [fileName, setFileName]   = useState('');
  const [status, setStatus]       = useState<Status>('idle');
  const [progress, setProgress]   = useState(0);
  const [replace, setReplace]     = useState(false);
  const [result, setResult]       = useState({ incomes: 0, expenses: 0, investments: 0, errors: 0 });
  const [errorMsg, setErrorMsg]   = useState('');
  const [dragging, setDragging]   = useState(false);

  const checkExistingMonths = async (yr: number, parsed: ParsedRecord[]): Promise<Set<number>> => {
    const monthsWithData = [...new Set(parsed.map(r => r.month))];
    const existing = new Set<number>();
    await Promise.all(
      monthsWithData.map(async m => {
        const [expRes, incRes] = await Promise.all([
          api.get('/expenses', { params: { month: m + 1, year: yr } }),
          api.get('/incomes',  { params: { month: m + 1, year: yr } }),
        ]);
        if (expRes.data.items.length > 0 || incRes.data.items.length > 0) {
          existing.add(m);
        }
      })
    );
    return existing;
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const yearMatch = file.name.match(/20\d{2}/);
    const detectedYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
    if (yearMatch) setYear(detectedYear);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const parsed = parseSpreadsheet(wb);

        setStatus('checking');
        const existingMonths = await checkExistingMonths(detectedYear, parsed);

        const sum = buildSummary(parsed, existingMonths);
        setRecords(parsed);
        setSummary(sum);
        setSelected(sum.filter(m => m.hasData).map(m => m.month));
        setReplace(false);
        setStatus('parsed');
      } catch {
        setErrorMsg('Não foi possível ler o arquivo. Verifique se é o formato correto.');
        setStatus('error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const toggleMonth = (m: number) =>
    setSelected(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const toggleAll = () =>
    setSelected(prev =>
      prev.length === summary.filter(m => m.hasData).length
        ? []
        : summary.filter(m => m.hasData).map(m => m.month)
    );

  const doImport = async () => {
    const toImport = records.filter(r => selected.includes(r.month));
    if (toImport.length === 0) return;

    setStatus('importing');
    setProgress(0);
    let incomes = 0, expenses = 0, investments = 0, errors = 0;

    // Se modo substituir: apaga todos os registros dos meses selecionados primeiro
    if (replace) {
      const monthsToReplace = [...new Set(toImport.map(r => r.month))];
      await Promise.all(
        monthsToReplace.flatMap(m => [
          api.delete('/expenses/by-month',   { params: { month: m + 1, year } }),
          api.delete('/incomes/by-month',    { params: { month: m + 1, year } }),
          api.delete('/investments/by-month',{ params: { month: m + 1, year } }),
        ])
      );
    }

    for (let i = 0; i < toImport.length; i++) {
      const r = toImport[i];
      const date = new Date(year, r.month, 1).toISOString().split('T')[0];

      try {
        if (r.type === 'income') {
          await api.post('/incomes', {
            date, description: r.description, category: r.category,
            value: r.value, type: 'fixed', person: r.person,
          });
          incomes++;
        } else if (r.type === 'expense') {
          await api.post('/expenses', {
            date, description: r.description, category: r.category,
            value: r.value, person: r.person, paymentMethod: 'Outros',
          });
          expenses++;
        } else {
          await api.post('/investments', {
            date, description: r.description, type: r.category,
            investedValue: r.value, currentValue: r.value, profitability: 0,
          });
          investments++;
        }
      } catch {
        errors++;
      }

      setProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setResult({ incomes, expenses, investments, errors });
    setStatus('done');
  };

  const reset = () => {
    setStatus('idle');
    setRecords([]);
    setSummary([]);
    setSelected([]);
    setFileName('');
    setProgress(0);
    setReplace(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const totalToImport    = records.filter(r => selected.includes(r.month)).length;
  const monthsWithConflict = summary.filter(m => m.hasExisting && selected.includes(m.month)).length;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Importar Planilha</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Importe dados do arquivo <strong>FINANCEIRO FAMILIA.xlsx</strong> diretamente para o sistema.
        </p>
      </div>

      {/* Upload zone */}
      {(status === 'idle' || status === 'error') && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`card p-10 flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-dashed transition-colors
            ${dragging
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10'
              : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
        >
          <FileSpreadsheet className="w-12 h-12 text-primary-400" />
          <div className="text-center">
            <p className="font-medium text-gray-700 dark:text-gray-300">Arraste o arquivo ou clique para selecionar</p>
            <p className="text-xs text-gray-400 mt-1">Formato: .xlsx (Planilha FINANCEIRO FAMILIA)</p>
          </div>
          <button className="btn-primary flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4" /> Selecionar arquivo
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onInputChange} />
        </div>
      )}

      {status === 'checking' && (
        <div className="card p-8 flex items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Verificando dados existentes...</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Preview & month selection */}
      {(status === 'parsed' || status === 'importing') && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold text-gray-800 dark:text-white">{fileName}</p>
              <p className="text-xs text-gray-400">{records.length} registros encontrados</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="label mb-0 text-sm">Ano</label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(parseInt(e.target.value))}
                className="input w-24 text-center"
                disabled={status === 'importing'}
              />
            </div>
          </div>

          {/* Aviso de conflito */}
          {monthsWithConflict > 0 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-amber-700 dark:text-amber-300">
                <span className="font-semibold">{monthsWithConflict} {monthsWithConflict === 1 ? 'mês já possui' : 'meses já possuem'} dados no sistema.</span>
                {' '}Escolha como deseja proceder:
              </div>
            </div>
          )}

          {/* Modo de importação */}
          {monthsWithConflict > 0 && (
            <div className="flex gap-3">
              <button
                onClick={() => setReplace(false)}
                disabled={status === 'importing'}
                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all
                  ${!replace
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
              >
                <p className="font-semibold">Adicionar</p>
                <p className="text-xs opacity-70 mt-0.5">Insere junto com os existentes</p>
              </button>
              <button
                onClick={() => setReplace(true)}
                disabled={status === 'importing'}
                className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-all
                  ${replace
                    ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
              >
                <p className="font-semibold">Substituir</p>
                <p className="text-xs opacity-70 mt-0.5">Apaga o existente e reimporta</p>
              </button>
            </div>
          )}

          {/* Month grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Selecione os meses para importar</p>
              <button
                onClick={toggleAll}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                disabled={status === 'importing'}
              >
                {selected.length === summary.filter(m => m.hasData).length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {summary.map(m => (
                <button
                  key={m.month}
                  disabled={!m.hasData || status === 'importing'}
                  onClick={() => toggleMonth(m.month)}
                  className={`p-3 rounded-xl border text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed
                    ${selected.includes(m.month)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{MONTH_NAMES[m.month]}</p>
                    {m.hasExisting && (
                      <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" aria-label="Já possui dados" />
                    )}
                  </div>
                  {m.hasData ? (
                    <div className="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {m.incomes > 0    && <p className="text-emerald-600 dark:text-emerald-400">+{m.incomes} receitas</p>}
                      {m.expenses > 0   && <p className="text-amber-600 dark:text-amber-400">+{m.expenses} despesas</p>}
                      {m.investments > 0 && <p className="text-blue-600 dark:text-blue-400">+{m.investments} invest.</p>}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">Sem dados</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          {status === 'importing' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Importando...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={reset} className="btn-secondary flex-1" disabled={status === 'importing'}>
              Cancelar
            </button>
            <button
              onClick={doImport}
              disabled={selected.length === 0 || status === 'importing'}
              className={`btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60
                ${replace ? 'bg-red-600 hover:bg-red-700' : ''}`}
            >
              {status === 'importing'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                : replace
                  ? `Substituir e importar ${totalToImport} registros`
                  : `Importar ${totalToImport} registros`
              }
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {status === 'done' && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="font-bold text-gray-900 dark:text-white">Importação concluída!</p>
              <p className="text-sm text-gray-500">Os dados já estão disponíveis no sistema.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-center">
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{result.incomes}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Receitas</p>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-center">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{result.expenses}</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Despesas</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{result.investments}</p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">Investimentos</p>
            </div>
          </div>
          {result.errors > 0 && (
            <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {result.errors} registro(s) não puderam ser importados.
            </p>
          )}
          <button onClick={reset} className="btn-primary w-full">
            Importar outro arquivo
          </button>
        </div>
      )}
    </div>
  );
}
