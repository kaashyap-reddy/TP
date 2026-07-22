interface TrendIndicatorProps {
  current: number | null;
  baseline: number | null;
  suffix?: string;
}

export default function TrendIndicator({ current, baseline, suffix = '%' }: TrendIndicatorProps) {
  if (current === null || baseline === null) return null;
  const delta = Math.round((current - baseline) * 10) / 10;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
        <span className="h-1 w-2.5 rounded-full bg-gray-300" />
        No change this session
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
      }`}
    >
      <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={up ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'} />
      </svg>
      {Math.abs(delta)}{suffix} this session
    </span>
  );
}
