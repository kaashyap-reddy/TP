import { ReactNode } from 'react';

interface Column {
  key: string;
  label: string;
}

interface TableProps {
  columns: Column[];
  children: ReactNode;
  theadRowClassName?: string;
  tbodyClassName?: string;
}

export default function Table({
  columns,
  children,
  theadRowClassName = 'bg-gray-50 text-gray-600 text-xs uppercase tracking-wider',
  tbodyClassName = 'divide-y divide-gray-200 text-sm'
}: TableProps) {
  return (
    <table className="w-full text-left border-collapse">
      <thead className="sticky top-0 z-10">
        <tr className={theadRowClassName}>
          {columns.map((col) => (
            <th key={col.key} className="px-6 py-3 font-medium">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className={tbodyClassName}>{children}</tbody>
    </table>
  );
}
