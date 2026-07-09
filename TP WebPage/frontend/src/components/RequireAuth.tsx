import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Role } from '../api/auth';

export default function RequireAuth({ role, children }: { role: Role; children: JSX.Element }) {
  const currentRole = useAuthStore((s) => s.role);
  const hydrated = useAuthStore((s) => s.hydrated);

  if (!hydrated) {
    return null;
  }

  if (currentRole !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}
