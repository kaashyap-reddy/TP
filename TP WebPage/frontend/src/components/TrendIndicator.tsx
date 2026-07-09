interface TrendIndicatorProps {
  current: number | null;
  baseline: number | null;
  suffix?: string;
}

export default function TrendIndicator({ current, baseline, suffix = '%' }: TrendIndicatorProps) {
  if (current === null || baseline === null) return null;
  const delta = Math.round((current - baseline) * 10) / 10;
  if (delta === 0) {
    return <span className="text-xs font-medium text-gray-400">— no change this session</span>;
  }
  const up = delta > 0;
  return (
    <span className={`text-xs font-bold inline-flex items-center gap-0.5 ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(delta)}{suffix} this session
    </span>
  );
}
