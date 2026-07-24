import { useCallback, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useModalA11y } from '../hooks/useModalA11y';
import AccountSettingsForm from './AccountSettingsForm';
import Button from './Button';
import ConfirmDialog from './ConfirmDialog';
import { OVERLAY_Z } from './Modal';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

// A right-side slide-over so Settings stays layered on top of whatever dashboard tab the user
// was on, instead of navigating away to the full /account-settings route. Every entry point
// (sidebar, mobile nav drawer, profile dropdown) opens this same drawer via settingsDrawerStore.
export default function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  // Every dismissal path (close button, overlay click, Escape, and the form's own Cancel button
  // via onDone) funnels through here, so "discard unsaved changes?" only has to be handled once.
  // Stabilized with useCallback: without it, this function's identity changes on every render
  // (e.g. when confirmDiscardOpen flips), which makes useEscapeKey's effect tear down and
  // re-add its document listener -- reordering it to fire *after* the nested ConfirmDialog's own
  // Escape listener and making a second Escape press re-open the confirmation instead of
  // cancelling it.
  const requestClose = useCallback(() => {
    if (isDirty) {
      setConfirmDiscardOpen(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  useClickOutside(panelRef, requestClose, open);
  useEscapeKey(requestClose, open);
  useModalA11y(open, panelRef);

  if (!open) return null;

  return createPortal(
    <>
      <div className={`fixed inset-0 ${OVERLAY_Z} flex justify-end bg-black/30`}>
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-desc`}
          className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl outline-none motion-safe:animate-slide-in-right"
        >
          <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 px-6 py-5">
            <div>
              <h2 id={titleId} className="text-lg font-bold text-gray-900">
                Account Settings
              </h2>
              <p id={`${titleId}-desc`} className="mt-0.5 text-xs text-gray-500">
                Manage your profile information and security preferences.
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close" onClick={requestClose}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <AccountSettingsForm onDone={requestClose} onDirtyChange={setIsDirty} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Discard unsaved changes?"
        message="You have unsaved changes in Account Settings. If you leave now, they'll be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          // SettingsDrawer is mounted permanently by its parent (it just returns null when
          // !open), so this component's own isDirty state does NOT reset on "close" the way
          // AccountSettingsForm's does on remount -- it must be reset explicitly here, or the
          // next open/close cycle can show a stale "Discard unsaved changes?" prompt before
          // AccountSettingsForm's own mount effect has a chance to correct it.
          setIsDirty(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscardOpen(false)}
      />
    </>,
    document.body
  );
}
