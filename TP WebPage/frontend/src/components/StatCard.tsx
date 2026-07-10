import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  valueSuffix?: ReactNode;
  valueClassName?: string;
  trend?: ReactNode;
  actionText?: string;
  onClick?: () => void;
  hoverClassName?: string;
}

export default function StatCard({
  label,
  value,
  valueSuffix,
  valueClassName = 'text-4xl font-bold mt-2 text-gray-800',
  trend,
  actionText,
  onClick,
  hoverClassName
}: StatCardProps) {
  const clickClass = onClick ? ' cursor-pointer' : '';
  const hoverClass = hoverClassName ? ` ${hoverClassName}` : '';
  return (
    <div
      className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center${clickClass}${hoverClass}`}
      onClick={onClick}
    >
      <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">{label}</div>
      <div className={valueClassName}>
        {value}
        {valueSuffix}
      </div>
      {trend && <div className="mt-2">{trend}</div>}
      {actionText && <div className="text-yellow-500 text-sm mt-2 font-medium">{actionText}</div>}
    </div>
  );
}
