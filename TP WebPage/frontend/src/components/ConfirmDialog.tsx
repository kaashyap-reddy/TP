import { useEscapeKey } from '../hooks/useEscapeKey';

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

  return (
    <div
      className={`fixed inset-0 bg-gray-900 bg-opacity-50 ${open ? 'flex' : 'hidden'} items-center justify-center z-[90]`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg font-medium focus:outline-none focus:ring-2 ${danger ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
