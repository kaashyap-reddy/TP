import { useRef } from 'react';

// Freezes the first *non-null* value this sees and keeps returning that snapshot on every
// later render, so a stat card's TrendIndicator has something real to diff against.
// `useRef(value).current` looks equivalent but isn't: on the render before an async fetch
// resolves, `value` is still null/0-from-empty-data, and a plain ref freezes on that very
// first render -- so the "baseline" would be null forever and the trend badge never appears.
export function useBaseline(value: number | null): number | null {
  const ref = useRef<number | null>(null);
  if (ref.current === null && value !== null) {
    ref.current = value;
  }
  return ref.current;
}
