import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import InvitePage from './pages/InvitePage';
import RequireAuth from './components/RequireAuth';
import Toast from './components/Toast';
import { useAuthStore } from './store/authStore';
import { readSession } from './lib/authSession';

const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const FacilitatorDashboardPage = lazy(() => import('./pages/FacilitatorDashboardPage'));
const TraineeDashboardPage = lazy(() => import('./pages/TraineeDashboardPage'));
const AssignmentDetailPage = lazy(() => import('./pages/AssignmentDetailPage'));
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'));
const TraineeProfilePage = lazy(() => import('./pages/TraineeProfilePage'));

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const setSession = useAuthStore((s) => s.setSession);
  const markHydrated = useAuthStore((s) => s.markHydrated);

  useEffect(() => {
    const session = readSession();
    if (session) {
      setSession(session);
    } else {
      markHydrated();
    }
  }, [setSession, markHydrated]);

  return (
    <>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route
            path="/admin"
            element={
              <RequireAuth role="admin">
                <AdminDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/facilitator"
            element={
              <RequireAuth role="facilitator">
                <FacilitatorDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/trainee"
            element={
              <RequireAuth role="trainee">
                <TraineeDashboardPage />
              </RequireAuth>
            }
          />
          <Route path="/assignments/:assignmentId" element={<AssignmentDetailPage />} />
          <Route
            path="/facilitator/trainees/:traineeName"
            element={
              <RequireAuth role="facilitator">
                <TraineeProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/account-settings"
            element={
              <RequireAuth role="admin">
                <AccountSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/facilitator/account-settings"
            element={
              <RequireAuth role="facilitator">
                <AccountSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/trainee/account-settings"
            element={
              <RequireAuth role="trainee">
                <AccountSettingsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Toast />
    </>
  );
}
