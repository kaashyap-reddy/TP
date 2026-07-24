import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { Role } from '../types/role';
import { ROUTES } from '../constants/routes';

export default function RequireAuth({ role, children }: { role: Role | Role[]; children: JSX.Element }) {
  const currentRole = useAuthStore((s) => s.role);
  const hydrated = useAuthStore((s) => s.hydrated);
  const showToast = useToastStore((s) => s.showToast);
  const allowedRoles = Array.isArray(role) ? role : [role];
  const isAllowed = currentRole !== null && (allowedRoles as string[]).includes(currentRole);
  const deniedWrongRole = hydrated && currentRole !== null && !isAllowed;

  useEffect(() => {
    if (deniedWrongRole) {
      showToast("You don't have access to that page.", 'error');
    }
  }, [deniedWrongRole, showToast]);

  if (!hydrated) {
    return null;
  }

  // Not logged in at all -- send to login, same as before.
  if (currentRole === null) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // Logged in, but as a role this route doesn't allow -- show an access-denied page inside their
  // own shell instead of bouncing them all the way back to the login screen.
  if (!isAllowed) {
    return <Navigate to={ROUTES.ACCESS_DENIED} replace />;
  }

  return children;
}
