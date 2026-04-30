interface Props {
  isOpen:        boolean;
  title:         string;
  description?:  string;
  confirmLabel?: string;
  cancelLabel?:  string;
  danger?:       boolean;
  onConfirm:     () => void;
  onCancel:      () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel  = 'Cancelar',
  danger       = true,
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative z-10 card p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-start gap-4">
          {danger && (
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-secondary text-sm" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'btn-primary'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
