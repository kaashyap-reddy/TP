interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}

export default function Pagination({ page, pageCount, onPageChange, totalItems, pageSize }: PaginationProps) {
  if (pageCount <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50 text-sm">
      <span className="text-gray-500">
        Showing <span className="font-medium text-gray-700">{start}-{end}</span> of <span className="font-medium text-gray-700">{totalItems}</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors"
        >
          ‹ Prev
        </button>
        <span className="text-gray-500 px-1">Page {page} / {pageCount}</span>
        <button
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page === pageCount}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white transition-colors"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
