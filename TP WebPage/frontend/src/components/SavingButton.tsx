interface SavingButtonProps {
  onClick: () => void;
  isSaving: boolean;
  label: string;
  savingLabel?: string;
  className?: string;
  disabled?: boolean;
}

export default function SavingButton({ onClick, isSaving, label, savingLabel = 'Saving…', className, disabled }: SavingButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isSaving || disabled}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed ${className ?? 'px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700'}`}
    >
      {isSaving && (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {isSaving ? savingLabel : label}
    </button>
  );
}
