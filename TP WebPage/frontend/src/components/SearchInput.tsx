interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  clearable?: boolean;
  width?: string;
}

export default function SearchInput({ value, onChange, placeholder, ariaLabel, clearable = false, width = 'w-64' }: SearchInputProps) {
  const inputClass = `px-4 py-2 border rounded-lg outline-none ${width} shadow-sm${clearable ? ' focus:ring-2 focus:ring-blue-500' : ''}`;

  if (!clearable) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={inputClass}
      />
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={inputClass}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      )}
    </div>
  );
}
