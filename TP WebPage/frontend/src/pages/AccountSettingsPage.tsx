import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Role } from '../types/role';
import Breadcrumbs from '../components/Breadcrumbs';
import AccountSettingsForm, { ACCOUNT_SETTINGS_META } from '../components/AccountSettingsForm';

// Both in-app entry points (sidebar, profile menu) now open AccountSettingsForm inside
// SettingsDrawer via settingsDrawerStore instead of navigating here. This route/page stays as a
// deep-link/bookmark fallback for anyone who lands on /account-settings directly.
export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role) as Role;
  const meta = ACCOUNT_SETTINGS_META[role];

  function handleBack() {
    navigate(meta.dashboardPath);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <button onClick={handleBack} className="text-sm text-blue-600 hover:underline font-medium mb-3">
          ‹ Back to {meta.dashboardLabel}
        </button>
        <Breadcrumbs trail={[meta.dashboardLabel, 'Account Settings']} />
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile information and security preferences.</p>
      </header>

      <div className="p-8 max-w-3xl mx-auto pb-8">
        <AccountSettingsForm onDone={handleBack} />
      </div>
    </div>
  );
}
