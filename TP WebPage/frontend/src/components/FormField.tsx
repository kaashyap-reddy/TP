import { cloneElement, isValidElement, ReactElement, ReactNode, useId } from 'react';

export function inputClass(hasError: boolean, ring: string) {
  return `w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 ${ring} transition-colors ${hasError ? 'border-red-400' : 'border-gray-300'}`;
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  // The actual control is passed as children (an <input>/<select>/<textarea> from the caller) —
  // clone it to wire up the id/aria attributes so <label> stays properly associated without
  // every call site having to manage ids itself.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': errorId
      })
    : children;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {control}
      {error && (
        <p id={errorId} className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

export function ReadOnlyField({ label, value }: { label: string; value?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input id={id} type="text" value={value ?? '—'} readOnly className="w-full px-3 py-2 border rounded-lg outline-none bg-gray-50 text-gray-500" />
    </div>
  );
}
