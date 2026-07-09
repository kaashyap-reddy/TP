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
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 hover:-translate-y-0.5 transition-all duration-150 text-center"
          >
            <span className="w-8 h-8 flex items-center justify-center text-blue-600">{a.icon}</span>
            <span className="text-xs font-bold text-gray-700">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
