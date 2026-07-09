import { useEffect } from 'react';
import { useToastStore } from '../store/toastStore';

const VARIANT_STYLES = {
  success: { bg: 'bg-gray-900', icon: 'text-green-400', path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  error: { bg: 'bg-red-700', icon: 'text-red-200', path: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  info: { bg: 'bg-blue-700', icon: 'text-blue-200', path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
};

export default function Toast() {
  const { message, variant, key, clearToast } = useToastStore();

  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(() => clearToast(), 2500);
    return () => clearTimeout(timer);
  }, [key, message, clearToast]);

  if (!message) return null;

  const style = VARIANT_STYLES[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2 ${style.bg} text-white text-sm font-medium px-4 py-3 rounded-xl shadow-2xl transition-opacity`}
    >
      <svg className={`w-5 h-5 ${style.icon} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.path} />
      </svg>
      {message}
    </div>
  );
}
