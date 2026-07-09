import { useEffect, useMemo, useRef, useState } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import HighlightMatch from './HighlightMatch';
import EmptyState from './EmptyState';

export interface SearchItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  items: SearchItem[];
  onSelect: (item: SearchItem) => void;
}

export default function GlobalSearch({ open, onClose, items, onSelect }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useClickOutside(panelRef, onClose, open);
  useEscapeKey(onClose, open);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return items.slice(0, 20);
    return items.filter((i) => i.title.toLowerCase().includes(q) || i.subtitle?.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)).slice(0, 30);
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) {
        onSelect(item);
        onClose();
      }
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/40 z-[95] flex items-start justify-center pt-24" role="dialog" aria-modal="true" aria-label="Global search">
      <div ref={panelRef} className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search batches, assignments, resources, announcements, sessions…"
            className="flex-1 outline-none text-sm"
            aria-label="Global search input"
          />
          <kbd className="text-[10px] font-bold text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState title="No matches" message="Try a different search term." icon="search" />
          ) : (
            filtered.map((item, i) => (
              <button
                key={`${item.category}-${item.id}`}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors ${i === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    <HighlightMatch text={item.title} query={query} />
                  </div>
                  {item.subtitle && <div className="text-xs text-gray-400 truncate">{item.subtitle}</div>}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">{item.category}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
