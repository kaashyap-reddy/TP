import { ReactNode } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: ReactNode;
  maxWidth?: 'sm' | 'md';
  children: ReactNode;
}

const TITLE_CLASS: Record<'sm' | 'md', string> = {
  sm: 'text-lg font-bold',
  md: 'text-xl font-bold'
};

const MAX_WIDTH_CLASS: Record<'sm' | 'md', string> = {
  sm: 'max-w-sm',
  md: 'max-w-md'
};

export default function Modal({ open, onClose, title, subtitle, maxWidth = 'sm', children }: ModalProps) {
  useEscapeKey(onClose, open);

  return (
    <div
      className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${open ? 'flex' : 'hidden'} items-center justify-center z-50`}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className={`bg-white rounded-xl shadow-xl w-full ${MAX_WIDTH_CLASS[maxWidth]} p-6`} onClick={(e) => e.stopPropagation()}>
        {title && <h2 className={`${TITLE_CLASS[maxWidth]} ${subtitle ? 'mb-1' : 'mb-4'}`}>{title}</h2>}
        {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
