import { Fragment, ReactNode, useRef, useState } from 'react';
import { NavItem } from '../constants/navigation';
import { isDemoMode } from '../services/api/demoMode';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import SettingsDrawer from '../components/SettingsDrawer';

export interface NavGroupDef {
  key: string;
  label: string;
  iconPath: string;
}

// navItems[0] is always the dashboard/home tab per the standardized order documented in
// constants/navigation.ts; everything after it is split by `group` into collapsible
// dropdowns below. `navGroups` names those dropdowns -- if omitted, callers get the
// original two-group "Me" / "Global" layout for free (Facilitator and Trainee rely on
// this default; only Admin currently passes its own group list).
interface DashboardLayoutProps<TabId extends string> {
  brandLabel: string;
  navItems: NavItem<TabId>[];
  navGroups?: NavGroupDef[];
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  onLogout: () => void;
  headerTitle: string;
  headerTitleClassName?: string;
  headerExtra?: ReactNode;
  headerRight: ReactNode;
  children: ReactNode;
}

// Heroicons-style "user-circle": an avatar silhouette inside a ring, reads clearly as
// "your own stuff" at a glance rather than a generic person glyph.
const PERSON_ICON =
  'M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z';
// Heroicons-style "globe": meridian + latitude lines over a circle, reads as
// "world / shared across the org" for the Global dropdown.
const GLOBAL_ICON =
  'M12 21a9 9 0 100-18 9 9 0 000 18zM12 21c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3s4.5 4.03 4.5 9-2.015 9-4.5 9zM3.6 9h16.8M3.6 15h16.8';
const SETTINGS_ICON =
  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z';
const CHEVRON_DOWN_ICON = 'M19 9l-7 7-7-7';
const LOGOUT_ICON = 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1';

function ItemIcon({ path, size = 'w-5 h-5' }: { path: string; size?: string }) {
  return (
    <svg className={`${size} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

// One of the sidebar's top-level tiles: a wide rounded panel (spans the sidebar's inner
// width) with the icon anchored near the top and the label beneath it, rather than a
// vertically-centered square. Dropdown toggles (Me / Global) additionally render a small
// chevron badge in the top-right corner.
function StackItem({
  icon,
  label,
  active,
  onClick,
  chevronOpen
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  chevronOpen?: boolean;
}) {
  const isToggle = chevronOpen !== undefined;
  return (
    <button
      onClick={onClick}
      aria-expanded={isToggle ? chevronOpen : undefined}
      className={`group relative flex h-14 w-full flex-col items-center justify-start gap-1 rounded-2xl pt-2 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950 active:scale-[0.98] ${
        active
          ? 'bg-gradient-to-b from-white/[0.16] to-white/[0.05] text-white shadow-[0_8px_20px_-8px_rgba(56,189,248,0.45)] ring-1 ring-inset ring-white/15'
          : 'text-blue-200/70 hover:bg-white/[0.08] hover:text-white'
      }`}
    >
      <span className={active ? 'text-cyan-300' : 'text-current'}>
        <ItemIcon path={icon} size="w-5 h-5" />
      </span>
      <span className={`text-[11px] leading-none tracking-wide ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
      {active && <span className="h-0.5 w-4 rounded-full bg-cyan-300/90" />}
      {isToggle && (
        <span
          className={`absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full transition-all duration-200 ease-out ${
            active ? 'bg-white/15' : 'bg-white/10 group-hover:bg-white/15'
          } ${chevronOpen ? 'rotate-180' : ''}`}
        >
          <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={CHEVRON_DOWN_ICON} />
          </svg>
        </span>
      )}
    </button>
  );
}

const DEFAULT_NAV_GROUPS: NavGroupDef[] = [
  { key: 'me', label: 'Me', iconPath: PERSON_ICON },
  { key: 'global', label: 'Global', iconPath: GLOBAL_ICON }
];

export default function DashboardLayout<TabId extends string>({
  brandLabel,
  navItems,
  navGroups = DEFAULT_NAV_GROUPS,
  activeTab,
  onTabChange,
  onLogout,
  headerTitle,
  headerTitleClassName = 'text-xl font-semibold',
  headerExtra,
  headerRight,
  children
}: DashboardLayoutProps<TabId>) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const dropdownsRef = useRef<HTMLDivElement>(null);
  useClickOutside(dropdownsRef, () => setOpenSection(null), openSection !== null);
  useEscapeKey(() => setOpenSection(null), openSection !== null);

  const [dashboardItem, ...rest] = navItems;
  const defaultGroupKey = navGroups[0]?.key;
  const itemsForGroup = (groupKey: string) => rest.filter((item) => (item.group ?? defaultGroupKey) === groupKey);

  // Only one group can be open at a time (accordion behavior) -- clicking a child item
  // navigates but deliberately leaves the section expanded, so the user can always see
  // which area they're working in; it only collapses via the parent toggle, another
  // group's toggle, an outside click, or Escape.
  function renderDropdown(id: string, icon: string, label: string, items: NavItem<TabId>[]) {
    const open = openSection === id;
    const active = items.some((item) => item.tabId === activeTab);
    return (
      <div>
        <StackItem icon={icon} label={label} active={active} chevronOpen={open} onClick={() => setOpenSection(open ? null : id)} />
        {/* Expands downward inside the sidebar column itself (grid-rows animates 0fr -> 1fr,
            which animates height without a fixed pixel value) instead of flying out beside it.
            The inner list caps its own height and scrolls internally past that point -- so a
            group with more items than the sidebar has room for never pushes the whole nav (and
            Settings/Logout below it) into needing a scrollbar of its own. */}
        <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="mt-1.5 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl bg-black/20 p-1.5 shadow-inner ring-1 ring-white/5">
              {items.map((item) => {
                const itemActive = activeTab === item.tabId;
                return (
                  <button
                    key={item.tabId}
                    onClick={() => onTabChange(item.tabId)}
                    className={`flex w-full flex-shrink-0 items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-1.5 text-left text-[11px] leading-tight transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 focus-visible:ring-offset-1 focus-visible:ring-offset-blue-950 ${
                      itemActive
                        ? 'border-cyan-300 bg-white/10 font-semibold text-white shadow-sm ring-1 ring-inset ring-white/10'
                        : 'border-transparent font-medium text-blue-100/75 hover:translate-x-0.5 hover:border-white/20 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <ItemIcon path={item.iconPath} size="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden text-gray-800" style={{ backgroundColor: '#f8fafc' }}>
      {isDemoMode() && (
        <div className="flex-shrink-0 bg-amber-400 text-amber-950 text-xs font-semibold text-center py-1 z-30">
          Demo Mode — sample data only, not connected to a real database
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 flex-shrink-0 bg-blue-950 flex flex-col z-20">
          <div className="flex h-16 items-center justify-center border-b border-white/10 px-3">
            <span className="text-center text-sm font-bold leading-tight text-white">{brandLabel}</span>
          </div>
          <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-4">
            <StackItem
              icon={dashboardItem.iconPath}
              label="Dashboard"
              active={activeTab === dashboardItem.tabId}
              onClick={() => onTabChange(dashboardItem.tabId)}
            />
            <div ref={dropdownsRef} className="flex flex-col gap-1.5">
              {navGroups.map((group) => (
                <Fragment key={group.key}>{renderDropdown(group.key, group.iconPath, group.label, itemsForGroup(group.key))}</Fragment>
              ))}
            </div>
            <StackItem icon={SETTINGS_ICON} label="Settings" active={settingsOpen} onClick={() => setSettingsOpen(true)} />
          </nav>
          <div className="mt-auto border-t border-white/10 px-3 py-3">
            <StackItem icon={LOGOUT_ICON} label="Logout" active={false} onClick={onLogout} />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 z-10 shadow-sm">
            <h1 className={`${headerTitleClassName} truncate min-w-0`}>{headerTitle}</h1>
            <div className="flex items-center space-x-6 flex-shrink-0">
              {headerExtra}
              {headerRight}
            </div>
          </header>
          {children}
        </main>
      </div>

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
