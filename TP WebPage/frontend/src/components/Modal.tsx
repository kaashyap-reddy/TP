import { ReactNode, useEffect, useId, useRef } from 'react';
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
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog when it opens so keyboard/screen-reader users land inside it
  // instead of it opening silently around wherever focus already was.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <div
      className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${open ? 'flex' : 'hidden'} items-center justify-center z-50 p-4`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`bg-white rounded-xl shadow-xl w-full ${MAX_WIDTH_CLASS[maxWidth]} p-6 outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id={titleId} className={`${TITLE_CLASS[maxWidth]} ${subtitle ? 'mb-1' : 'mb-4'}`}>
            {title}
          </h2>
        )}
        {subtitle && <p className="text-sm text-gray-500 mb-4">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
