import { SortDirection } from '../hooks/useSortableData';

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  activeKey: string;
  direction: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

export default function SortableHeader({ label, sortKey, activeKey, direction, onSort, className }: SortableHeaderProps) {
  const isActive = sortKey === activeKey;
  return (
    <th className={`px-6 py-3 font-medium select-none ${className ?? ''}`}>
      <button
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      >
        {label}
        <span className={`text-[10px] ${isActive ? 'text-blue-600' : 'text-gray-300'}`}>
          {isActive ? (direction === 'asc' ? '▲' : '▼') : '▲▼'}
        </span>
      </button>
    </th>
  );
}
