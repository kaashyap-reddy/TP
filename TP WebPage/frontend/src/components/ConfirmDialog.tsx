import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useModalA11y } from '../hooks/useModalA11y';
import Button from './Button';
import { OVERLAY_Z } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEscapeKey(onCancel, open);
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y(open, panelRef);

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center ${OVERLAY_Z} p-4`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div ref={panelRef} tabIndex={-1} className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 outline-none" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
