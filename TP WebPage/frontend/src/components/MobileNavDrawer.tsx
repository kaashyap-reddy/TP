import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { NavItem } from '../constants/navigation';
import type { NavGroupDef } from '../layouts/DashboardLayout';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useModalA11y } from '../hooks/useModalA11y';
import { useSettingsDrawerStore } from '../store/settingsDrawerStore';
import Button from './Button';
import { OVERLAY_Z } from './Modal';

const SETTINGS_ICON =
  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z';
const LOGOUT_ICON = 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1';

function ItemIcon({ path }: { path: string }) {
  return (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

interface MobileNavDrawerProps<TabId extends string> {
  open: boolean;
  onClose: () => void;
  brandLabel: string;
  navItems: NavItem<TabId>[];
  navGroups: NavGroupDef[];
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  onLogout: () => void;
}

// Off-canvas mobile/tablet nav: a flat list (unlike the desktop sidebar's nested accordions --
// there's no room to expand/collapse dropdowns in a narrow drawer, so every destination is
// listed directly under its group heading). Closes via close button, overlay click, Escape, or
// selecting any destination; focus/scroll/inert are handled by useModalA11y.
export default function MobileNavDrawer<TabId extends string>({
  open,
  onClose,
  brandLabel,
  navItems,
  navGroups,
  activeTab,
  onTabChange,
  onLogout
}: MobileNavDrawerProps<TabId>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const openSettings = useSettingsDrawerStore((s) => s.openSettings);
  useClickOutside(panelRef, onClose, open);
  useEscapeKey(onClose, open);
  useModalA11y(open, panelRef);

  if (!open) return null;

  const [dashboardItem, ...rest] = navItems;
  const defaultGroupKey = navGroups[0]?.key;
  const itemsForGroup = (groupKey: string) => rest.filter((item) => (item.group ?? defaultGroupKey) === groupKey);

  function go(tabId: TabId) {
    onTabChange(tabId);
    onClose();
  }

  function openSettingsAndClose() {
    onClose();
    openSettings();
  }

  function logoutAndClose() {
    onClose();
    onLogout();
  }

  const navButtonClass = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
      active ? 'bg-white/10 text-white' : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
    }`;

  return createPortal(
    <div className={`fixed inset-0 ${OVERLAY_Z} flex bg-black/30 motion-safe:animate-fade-in lg:hidden`}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-xs flex-col bg-blue-950 shadow-2xl outline-none motion-safe:animate-slide-in-left"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
          <span id={titleId} className="text-sm font-bold text-white">
            {brandLabel}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-blue-100 transition-colors duration-150 motion-reduce:transition-none hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950"
            onClick={onClose}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
          <button onClick={() => go(dashboardItem.tabId)} className={navButtonClass(activeTab === dashboardItem.tabId)}>
            <ItemIcon path={dashboardItem.iconPath} />
            Dashboard
          </button>

          {navGroups.map((group) => {
            const items = itemsForGroup(group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-blue-300/70">{group.label}</div>
                <div className="flex flex-col gap-1">
                  {items.map((item) => (
                    <button key={item.tabId} onClick={() => go(item.tabId)} className={navButtonClass(activeTab === item.tabId)}>
                      <ItemIcon path={item.iconPath} />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="flex-shrink-0 border-t border-white/10 px-3 py-3 space-y-1">
          <button onClick={openSettingsAndClose} className={navButtonClass(false)}>
            <ItemIcon path={SETTINGS_ICON} />
            Settings
          </button>
          <button onClick={logoutAndClose} className={navButtonClass(false)}>
            <ItemIcon path={LOGOUT_ICON} />
            Logout
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
