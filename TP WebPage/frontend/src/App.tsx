import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import InvitePage from './pages/InvitePage';
import RequireAuth from './components/RequireAuth';
import Toast from './components/Toast';
import { useAuthStore } from './store/authStore';
import { ROUTES, ROUTE_PATTERNS } from './constants/routes';

const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const FacilitatorDashboardPage = lazy(() => import('./pages/FacilitatorDashboardPage'));
const TraineeDashboardPage = lazy(() => import('./pages/TraineeDashboardPage'));
const AssignmentDetailPage = lazy(() => import('./pages/AssignmentDetailPage'));
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'));
const TraineeProfilePage = lazy(() => import('./pages/TraineeProfilePage'));
const FacilitatorBatchDetailPage = lazy(() => import('./pages/FacilitatorBatchDetailPage'));
const TrainingPlanDetailPage = lazy(() => import('./pages/admin/TrainingPlanDetailPage'));
const AdminTraineeProfilePage = lazy(() => import('./pages/admin/AdminTraineeProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.INVITE} element={<InvitePage />} />
          <Route
            path={ROUTES.ADMIN}
            element={
              <RequireAuth role="admin">
                <AdminDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTES.FACILITATOR}
            element={
              <RequireAuth role="facilitator">
                <FacilitatorDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTES.TRAINEE}
            element={
              <RequireAuth role="trainee">
                <TraineeDashboardPage />
              </RequireAuth>
            }
          />
          <Route path={ROUTE_PATTERNS.ASSIGNMENT_DETAIL} element={<AssignmentDetailPage />} />
          <Route
            path={ROUTE_PATTERNS.FACILITATOR_TRAINEE_PROFILE}
            element={
              <RequireAuth role="facilitator">
                <TraineeProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTE_PATTERNS.FACILITATOR_BATCH_DETAIL}
            element={
              <RequireAuth role="facilitator">
                <FacilitatorBatchDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTE_PATTERNS.ADMIN_TRAINING_PLAN_DETAIL}
            element={
              <RequireAuth role="admin">
                <TrainingPlanDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTE_PATTERNS.ADMIN_TRAINEE_PROFILE}
            element={
              <RequireAuth role="admin">
                <AdminTraineeProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTES.ADMIN_ACCOUNT_SETTINGS}
            element={
              <RequireAuth role="admin">
                <AccountSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTES.FACILITATOR_ACCOUNT_SETTINGS}
            element={
              <RequireAuth role="facilitator">
                <AccountSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path={ROUTES.TRAINEE_ACCOUNT_SETTINGS}
            element={
              <RequireAuth role="trainee">
                <AccountSettingsPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <Toast />
    </>
  );
}
