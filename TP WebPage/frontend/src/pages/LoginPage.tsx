import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, resetPassword } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { writeSession } from '../utils/authSession';
import { useToastStore } from '../store/toastStore';
import SavingButton from '../components/SavingButton';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { ROUTES } from '../constants/routes';

const pageBackground = { background: 'linear-gradient(135deg, #f0f4f8 0%, #e0eaf5 100%)' };
const glassCard = {
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
};

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const showToast = useToastStore((s) => s.showToast);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPass, setForgotPass] = useState('');
  const [forgotConfirm, setForgotConfirm] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEscapeKey(() => setForgotOpen(false), forgotOpen);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setError('');
    setIsSigningIn(true);
    try {
      const user = await login(email, password);
      setSession({ id: user.id, email: user.email, role: user.role, displayName: user.name });
      writeSession({ id: user.id, email: user.email, role: user.role, displayName: user.name }, rememberMe);
      navigate(ROUTES.DASHBOARD_FOR_ROLE(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
      showToast(err instanceof Error ? err.message : 'Unable to sign in.', 'error');
      setIsSigningIn(false);
    }
  }

  async function handleForgotPassword(event: FormEvent) {
    event.preventDefault();
    setForgotError('');
    if (forgotPass !== forgotConfirm) {
      setForgotError('Passwords do not match.');
      return;
    }
    if (forgotPass.length < 6) {
      setForgotError('Password must be at least 6 characters.');
      return;
    }
    setIsResetting(true);
    try {
      await resetPassword(forgotEmail, forgotPass);
      showToast('Password reset. You can now sign in with your new password.');
      setForgotOpen(false);
      setForgotEmail('');
      setForgotPass('');
      setForgotConfirm('');
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Unable to reset password.');
      showToast(err instanceof Error ? err.message : 'Unable to reset password.', 'error');
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={pageBackground}>
      <div className="glass-card w-full max-w-md rounded-2xl p-8 relative overflow-hidden" style={glassCard}>
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-2xl opacity-50"></div>
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-blue-300 rounded-full mix-blend-multiply filter blur-2xl opacity-50"></div>

        <div className="relative z-10 text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Welcome Back</h1>
          <p className="text-gray-500 mt-2">Sign in to Trainee Management Portal</p>
        </div>

        <form className="relative z-10 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Email</label>
            <input
              type="email"
              placeholder="you@company.com"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded text-blue-500 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-600">Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Forgot Password?
            </button>
          </div>

          <SavingButton
            onClick={() => {}}
            isSaving={isSigningIn}
            label="Sign In"
            savingLabel="Signing in…"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/30"
          />
        </form>

        <div className="mt-8 text-center relative z-10">
          <p className="text-sm text-gray-500">
            Trainee with an invite?{' '}
            <a href="/invite?email=trainee@company.com" className="text-blue-600 hover:underline font-medium">
              Click here
            </a>
          </p>
        </div>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" onClick={() => setForgotOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-1">Reset Password</h2>
            <p className="text-sm text-gray-500 mb-4">Enter your account email and choose a new password.</p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {forgotError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{forgotError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Email</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={forgotPass}
                  onChange={(e) => setForgotPass(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="••••••••"
                />
                <p className="text-xs text-gray-400 mt-1">At least 6 characters.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={forgotConfirm}
                  onChange={(e) => setForgotConfirm(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <SavingButton
                  onClick={() => {}}
                  isSaving={isResetting}
                  label="Reset Password"
                  savingLabel="Resetting…"
                  className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
