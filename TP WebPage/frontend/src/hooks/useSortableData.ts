import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export function useSortableData<T>(
  items: T[],
  getValue: (item: T, key: string) => string | number,
  defaultKey: string,
  defaultDir: SortDirection = 'asc'
) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultDir);

  function toggleSort(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const va = getValue(a, sortKey);
      const vb = getValue(b, sortKey);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      if (sa < sb) return sortDir === 'asc' ? -1 : 1;
      if (sa > sb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}
