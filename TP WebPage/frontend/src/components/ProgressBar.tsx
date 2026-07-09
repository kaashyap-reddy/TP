interface ProgressBarProps {
  value: number | null;
  color?: string;
  label?: string;
  size?: 'sm' | 'md';
}

export default function ProgressBar({ value, color = 'bg-blue-500', label, size = 'md' }: ProgressBarProps) {
  const percent = value ?? 0;
  const height = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="w-full">
      {label !== undefined && (
        <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-1">
          <span>{label}</span>
          <span className="font-bold text-gray-700">{value !== null ? `${value}%` : '—'}</span>
        </div>
      )}
      <div className={`w-full bg-gray-100 rounded-full ${height} overflow-hidden`}>
        <div
          className={`${color} ${height} rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
