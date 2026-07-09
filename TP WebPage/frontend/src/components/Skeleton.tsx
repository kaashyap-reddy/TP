export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse divide-y divide-gray-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-gray-200 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-gray-200 rounded" />
            <div className="h-2.5 w-1/2 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
          <div className="h-3 w-1/2 bg-gray-200 rounded" />
          <div className="h-7 w-2/3 bg-gray-200 rounded" />
          <div className="h-2.5 w-1/3 bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}
