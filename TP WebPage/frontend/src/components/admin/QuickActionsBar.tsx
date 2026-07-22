interface QuickAction {
  label: string;
  icon: JSX.Element;
  onClick: () => void;
}

interface QuickActionsBarProps {
  actions: QuickAction[];
}

export default function QuickActionsBar({ actions }: QuickActionsBarProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-8">
      <h3 className="font-bold text-gray-800 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="group flex flex-col items-center justify-center gap-2.5 p-4 rounded-lg border border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 text-center"
          >
            <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors duration-150 group-hover:bg-blue-100">
              {a.icon}
            </span>
            <span className="text-xs font-bold text-gray-700">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
