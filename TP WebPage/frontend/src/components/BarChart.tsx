export interface BarChartDatum {
  label: string;
  percent: number;
  displayValue: string;
  color?: string;
}

interface BarChartProps {
  data: BarChartDatum[];
  labelWidth?: string;
}

export default function BarChart({ data, labelWidth = 'w-36' }: BarChartProps) {
  return (
    <div className="w-full space-y-3">
      {data.map((d) => (
        <div className="flex items-center gap-3" key={d.label}>
          <span className={`${labelWidth} text-xs text-gray-600 text-right flex-shrink-0`}>{d.label}</span>
          <div className="flex-1 bg-gray-200 rounded-full h-4">
            <div
              className={`${d.color ?? 'bg-blue-500'} h-4 rounded-full transition-all duration-300`}
              style={{ width: `${Math.min(Math.max(d.percent, 0), 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold text-gray-700 w-14 flex-shrink-0">{d.displayValue}</span>
        </div>
      ))}
    </div>
  );
}
