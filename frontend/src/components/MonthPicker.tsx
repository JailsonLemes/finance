import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  date: Date;
  onChange: (date: Date) => void;
}

export default function MonthPicker({ date, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-1.5">
      <button
        onClick={() => onChange(subMonths(date, 1))}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-32 text-center capitalize">
        {format(date, 'MMMM yyyy', { locale: ptBR })}
      </span>
      <button
        onClick={() => onChange(addMonths(date, 1))}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
