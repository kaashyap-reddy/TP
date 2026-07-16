import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ROUTES } from '../constants/routes';

/**
 * Shown for any URL no route matches (the `*` catch-all in App.tsx) — a real 404 instead of
 * silently bouncing to the login page, so a mistyped or stale link is visibly wrong.
 */
export default function NotFoundPage() {
  const { pathname } = useLocation();
  const role = useAuthStore((s) => s.role);
  const homePath = role ? ROUTES.DASHBOARD_FOR_ROLE(role) : ROUTES.LOGIN;
  const homeLabel = role ? 'Go to my dashboard' : 'Go to sign in';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-5xl font-black text-blue-600">404</p>
        <h1 className="mt-3 text-xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500 break-all">
          There's nothing at <span className="font-mono text-gray-700">{pathname}</span>. The link may be mistyped or out of date.
        </p>
        <Link
          to={homePath}
          replace
          className="mt-6 inline-block bg-blue-600 text-white text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
