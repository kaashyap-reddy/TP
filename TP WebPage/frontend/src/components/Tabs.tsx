export interface TabOption {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabOption[];
  active: string;
  onChange: (value: string) => void;
  'aria-label': string;
}

export default function Tabs({ tabs, active, onChange, 'aria-label': ariaLabel }: TabsProps) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex items-center gap-1 border-b border-gray-200 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-t ${
              isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
