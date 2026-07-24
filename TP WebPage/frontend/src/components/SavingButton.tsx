import Button from './Button';

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
    <Button
      onClick={onClick}
      loading={isSaving}
      loadingLabel={savingLabel}
      disabled={disabled}
      className={className ? `inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed ${className}` : undefined}
    >
      {label}
    </Button>
  );
}
