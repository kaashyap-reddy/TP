import { ReactNode, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useModalA11y } from '../hooks/useModalA11y';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const TITLE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-lg font-bold',
  md: 'text-xl font-bold',
  lg: 'text-xl font-bold'
};

const MAX_WIDTH_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl'
};

// Shared z-index for every true modal/drawer overlay (Modal, ConfirmDialog, SettingsDrawer,
// MobileNavDrawer) so stacking is predictable instead of each file picking its own value.
export const OVERLAY_Z = 'z-[100]';

export default function Modal({ open, onClose, title, subtitle, maxWidth = 'sm', children }: ModalProps) {
  useEscapeKey(onClose, open);
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y(open, panelRef);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center ${OVERLAY_Z} p-4`}
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
    </div>,
    document.body
  );
}
