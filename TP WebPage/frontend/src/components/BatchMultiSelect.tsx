import { useId } from 'react';
import type { Batch } from '../types/batch';

interface BatchMultiSelectProps {
  batches: Batch[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  error?: string;
}

/** Checkbox-list multi-select for assigning one assignment to several batches at once. */
export default function BatchMultiSelect({ batches, selectedIds, onChange, label = 'Assign to Batches', error }: BatchMultiSelectProps) {
  const groupId = useId();

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  const selectedBatches = batches.filter((b) => selectedIds.includes(b.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span id={groupId} className="block text-sm font-medium text-gray-700">
          {label}
        </span>
        {batches.length > 1 && (
          <button
            type="button"
            onClick={() => onChange(selectedIds.length === batches.length ? [] : batches.map((b) => b.id))}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            {selectedIds.length === batches.length ? 'Clear all' : 'Select all'}
          </button>
        )}
      </div>

      {selectedBatches.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2" aria-live="polite">
          {selectedBatches.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
              {b.name}
              <button
                type="button"
                onClick={() => toggle(b.id)}
                aria-label={`Remove ${b.name}`}
                className="hover:text-blue-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        role="group"
        aria-labelledby={groupId}
        className={`max-h-40 overflow-y-auto border rounded-lg divide-y divide-gray-100 ${error ? 'border-red-400' : 'border-gray-300'}`}
      >
        {batches.length === 0 ? (
          <p className="text-sm text-gray-400 p-3">No batches available.</p>
        ) : (
          batches.map((b) => (
            <label key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.includes(b.id)}
                onChange={() => toggle(b.id)}
                className="rounded text-blue-500 focus:ring-blue-500 border-gray-300"
              />
              <span className="text-gray-700">{b.name}</span>
            </label>
          ))
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
