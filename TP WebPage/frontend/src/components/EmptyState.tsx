interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: 'search' | 'inbox' | 'calendar';
}

const ICONS: Record<NonNullable<EmptyStateProps['icon']>, JSX.Element> = {
  search: (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
    </svg>
  ),
  inbox: (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3" />
    </svg>
  ),
  calendar: (
    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
};

export default function EmptyState({ title, message, icon = 'inbox' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 text-gray-400">
      <div className="text-gray-300 mb-3">{ICONS[icon]}</div>
      <div className="font-bold text-gray-500">{title}</div>
      {message && <p className="text-sm text-gray-400 mt-1 max-w-sm">{message}</p>}
    </div>
  );
}
