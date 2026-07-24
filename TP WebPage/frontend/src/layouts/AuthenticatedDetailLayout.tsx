import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout, { NavGroupDef } from './DashboardLayout';
import type { NavItem } from '../constants/navigation';
import {
  ADMIN_BRAND_LABEL,
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_ITEMS,
  FACILITATOR_BRAND_LABEL,
  FACILITATOR_NAV_ITEMS,
  TRAINEE_BRAND_LABEL,
  TRAINEE_NAV_ITEMS
} from '../constants/navigation';
import { ROUTES } from '../constants/routes';
import { Role } from '../types/role';
import { logout } from '../services/api/authService';
import { useAuthStore } from '../store/authStore';
import Breadcrumbs from '../components/Breadcrumbs';
import Button from '../components/Button';
import ConfirmDialog from '../components/ConfirmDialog';
import NotificationBell from '../components/NotificationBell';
import ProfileDropdown from '../components/ProfileDropdown';

interface RoleNavConfig {
  brandLabel: string;
  navItems: NavItem<string>[];
  navGroups?: NavGroupDef[];
  dashboardRoute: string;
  headerTitleClassName: string;
}

const ROLE_NAV_CONFIG: Record<Role, RoleNavConfig> = {
  admin: {
    brandLabel: ADMIN_BRAND_LABEL,
    navItems: ADMIN_NAV_ITEMS,
    navGroups: ADMIN_NAV_GROUPS,
    dashboardRoute: ROUTES.ADMIN,
    headerTitleClassName: 'text-xl font-bold text-gray-800 tracking-tight'
  },
  facilitator: {
    brandLabel: FACILITATOR_BRAND_LABEL,
    navItems: FACILITATOR_NAV_ITEMS,
    dashboardRoute: ROUTES.FACILITATOR,
    headerTitleClassName: 'text-xl font-semibold'
  },
  trainee: {
    brandLabel: TRAINEE_BRAND_LABEL,
    navItems: TRAINEE_NAV_ITEMS,
    dashboardRoute: ROUTES.TRAINEE,
    headerTitleClassName: 'text-xl font-semibold'
  }
};

interface AuthenticatedDetailLayoutProps {
  role: Role;
  /** Which sidebar item to highlight while on this detail page -- must match one of that role's real tab ids. */
  activeTab: string;
  headerTitle: string;
  breadcrumbTrail: string[];
  onBack: () => void;
  backLabel: string;
  children: ReactNode;
}

/**
 * The one shared shell wrapper for every "detail/editing" page that isn't itself one of the three
 * main dashboards (assignment detail, batch detail, training plan detail, trainee profile, etc.).
 * Renders the exact same DashboardLayout the dashboards use -- same sidebar, header, mobile
 * drawer, Settings/Logout -- so these pages stop rendering as visually unrelated standalone
 * pages. New detail/editing pages should use this instead of a bare `<div>` wrapper.
 */
export default function AuthenticatedDetailLayout({
  role,
  activeTab,
  headerTitle,
  breadcrumbTrail,
  onBack,
  backLabel,
  children
}: AuthenticatedDetailLayoutProps) {
  const navigate = useNavigate();
  const clearSession = useAuthStore((s) => s.clearSession);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const config = ROLE_NAV_CONFIG[role];

  return (
    <DashboardLayout<string>
      brandLabel={config.brandLabel}
      navItems={config.navItems}
      navGroups={config.navGroups}
      activeTab={activeTab}
      onTabChange={(tabId) => navigate(config.dashboardRoute, { state: { tab: tabId } })}
      onLogout={() => setLogoutConfirmOpen(true)}
      headerTitle={headerTitle}
      headerTitleClassName={config.headerTitleClassName}
      headerRight={
        <>
          <NotificationBell />
          <ProfileDropdown role={role} onSignOut={() => setLogoutConfirmOpen(true)} />
        </>
      }
    >
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mb-1 flex items-center justify-between gap-4">
          <Breadcrumbs trail={breadcrumbTrail} />
        </div>
        <Button variant="link" size="sm" onClick={onBack} className="mb-4 -ml-2">
          ‹ {backLabel}
        </Button>
        {children}
      </div>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        danger
        onConfirm={() => {
          logout().finally(() => {
            clearSession();
            navigate(ROUTES.LOGIN);
          });
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </DashboardLayout>
  );
}
