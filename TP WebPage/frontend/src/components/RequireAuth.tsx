import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { Role } from '../api/auth';
import { ROUTES } from '../constants/routes';

export default function RequireAuth({ role, children }: { role: Role; children: JSX.Element }) {
  const currentRole = useAuthStore((s) => s.role);
  const hydrated = useAuthStore((s) => s.hydrated);
  const showToast = useToastStore((s) => s.showToast);
  const deniedWrongRole = hydrated && currentRole !== null && currentRole !== role;

  useEffect(() => {
    if (deniedWrongRole) {
      showToast("You don't have access to that page.", 'error');
    }
  }, [deniedWrongRole, showToast]);

  if (!hydrated) {
    return null;
  }

  if (currentRole !== role) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return children;
}
