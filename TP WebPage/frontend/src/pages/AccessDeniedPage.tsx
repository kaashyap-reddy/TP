import { Navigate, useNavigate } from 'react-router-dom';
import AuthenticatedDetailLayout from '../layouts/AuthenticatedDetailLayout';
import Button from '../components/Button';
import { useAuthStore } from '../store/authStore';
import { ROUTES } from '../constants/routes';
import { Role } from '../types/role';

const DASHBOARD_TAB: Record<Role, string> = {
  admin: 'analytics',
  facilitator: 'dashboard',
  trainee: 'dashboard'
};

// Reached when RequireAuth redirects a logged-in user whose role doesn't match a route's
// allowed roles -- rendered inside *their own* shell (not the page they were denied) so it
// reads as "you can't go there" rather than "you got logged out."
export default function AccessDeniedPage() {
  const role = useAuthStore((s) => s.role);
  const hydrated = useAuthStore((s) => s.hydrated);
  const navigate = useNavigate();

  if (!hydrated) return null;
  if (!role) return <Navigate to={ROUTES.LOGIN} replace />;

  return (
    <AuthenticatedDetailLayout
      role={role}
      activeTab={DASHBOARD_TAB[role]}
      headerTitle="Access Denied"
      breadcrumbTrail={['Access Denied']}
      onBack={() => navigate(-1)}
      backLabel="Go back"
    >
      <div className="flex flex-col items-center justify-center text-center py-20 px-6">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">You don't have permission to view that page</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          Your account doesn't have access to the page you tried to open. If you think this is a mistake, contact an administrator.
        </p>
        <Button onClick={() => navigate(ROUTES.DASHBOARD_FOR_ROLE(role))}>Go to my dashboard</Button>
      </div>
    </AuthenticatedDetailLayout>
  );
}
