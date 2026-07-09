interface StatusBadgeProps {
  status: string;
  colorMap?: Record<string, string>;
}

const DEFAULT_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-800',
  Upcoming: 'bg-amber-100 text-amber-800',
  Live: 'bg-red-100 text-red-700',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-gray-200 text-gray-600',
  Rescheduled: 'bg-purple-100 text-purple-700',
  Draft: 'bg-gray-100 text-gray-600',
  Open: 'bg-blue-100 text-blue-700',
  Closed: 'bg-gray-200 text-gray-600',
  Overdue: 'bg-red-100 text-red-700',
  Verified: 'bg-green-100 text-green-800',
  'Not Started': 'bg-gray-100 text-gray-500',
  'Under Review': 'bg-yellow-100 text-yellow-800',
  Late: 'bg-red-100 text-red-800',
  Critical: 'bg-red-100 text-red-700',
  Important: 'bg-blue-100 text-blue-700',
  Normal: 'bg-gray-100 text-gray-600'
};

export default function StatusBadge({ status, colorMap }: StatusBadgeProps) {
  const classes = (colorMap ?? DEFAULT_COLORS)[status] ?? 'bg-gray-100 text-gray-600';
  return <span className={`px-2.5 py-1 rounded-full font-bold text-xs whitespace-nowrap ${classes}`}>{status}</span>;
}
