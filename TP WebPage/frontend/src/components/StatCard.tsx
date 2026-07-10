import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  valueSuffix?: ReactNode;
  trend?: ReactNode;
  actionText?: string;
  onClick?: () => void;
}

export default function StatCard({ label, value, valueSuffix, trend, actionText, onClick }: StatCardProps) {
  return (
    <div
      className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center${onClick ? ' cursor-pointer hover:shadow-md transition' : ''}`}
      onClick={onClick}
    >
      <div className="text-gray-500 text-sm font-medium uppercase tracking-wide">{label}</div>
      <div className="text-4xl font-bold mt-2 text-gray-800">
        {value}
        {valueSuffix}
      </div>
      {trend && <div className="mt-2">{trend}</div>}
      {actionText && <div className="text-yellow-500 text-sm mt-2 font-medium">{actionText}</div>}
    </div>
  );
}
