import { ReactNode } from 'react';
import { NavItem } from '../constants/navigation';
import { isDemoMode } from '../services/api/demoMode';

interface DashboardLayoutProps<TabId extends string> {
  brandLabel: string;
  navItems: NavItem<TabId>[];
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
  activeNavExtraClass?: string;
  onLogout: () => void;
  logoutButtonClassName?: string;
  headerTitle: string;
  headerTitleClassName?: string;
  headerExtra?: ReactNode;
  headerRight: ReactNode;
  children: ReactNode;
}

function navItemClass(active: boolean, activeExtraClass: string) {
  return active
    ? `flex items-center px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg font-medium${activeExtraClass ? ` ${activeExtraClass}` : ''}`
    : 'flex items-center px-4 py-2.5 text-gray-600 hover:bg-gray-50 rounded-lg font-medium';
}

export default function DashboardLayout<TabId extends string>({
  brandLabel,
  navItems,
  activeTab,
  onTabChange,
  activeNavExtraClass = '',
  onLogout,
  logoutButtonClassName = 'flex items-center px-4 py-2 text-gray-600 hover:text-red-600 transition-colors w-full',
  headerTitle,
  headerTitleClassName = 'text-xl font-semibold',
  headerExtra,
  headerRight,
  children
}: DashboardLayoutProps<TabId>) {
  return (
    <div className="flex flex-col h-screen overflow-hidden text-gray-800" style={{ backgroundColor: '#f8fafc' }}>
      {isDemoMode() && (
        <div className="flex-shrink-0 bg-amber-400 text-amber-950 text-xs font-semibold text-center py-1 z-30">
          Demo Mode — sample data only, not connected to a real database
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col z-20">
          <div className="h-16 flex items-center px-6 border-b border-gray-200">
            <span className="text-lg font-bold text-blue-600">{brandLabel}</span>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.tabId}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onTabChange(item.tabId);
                }}
                className={navItemClass(activeTab === item.tabId, activeNavExtraClass)}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
                </svg>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-200">
            <button onClick={onLogout} className={logoutButtonClassName}>
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
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
    </div>
  );
}
