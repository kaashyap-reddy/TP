import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/api/authService';
import { useToastStore } from '../store/toastStore';
import { ROUTES } from '../constants/routes';

const pageBackground = { background: 'linear-gradient(135deg, #f0f4f8 0%, #e0eaf5 100%)' };
const glassCard = {
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
};

/** Landing page for the emailed reset link (`/reset-password?token=...`) — sibling of InvitePage. */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const showToast = useToastStore((s) => s.showToast);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleReset(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      showToast('Password reset. You can now sign in with your new password.');
      navigate(ROUTES.LOGIN, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={pageBackground}>
        <div className="glass-card w-full max-w-md rounded-2xl p-8 text-center relative overflow-hidden" style={glassCard}>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Invalid Reset Link</h1>
          <p className="text-gray-500 mb-6">This reset link is missing or malformed. Use "Forgot Password?" on the sign-in page to request a new one.</p>
          <a href="/" className="text-blue-600 hover:underline font-medium">‹ Back to Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={pageBackground}>
      <div className="glass-card w-full max-w-md rounded-2xl p-8 relative overflow-hidden" style={glassCard}>
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-2xl opacity-50"></div>
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-blue-300 rounded-full mix-blend-multiply filter blur-2xl opacity-50"></div>

        <div className="relative z-10 text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Choose a New Password</h1>
          <p className="text-gray-500 mt-2">Set a new password for your Trainee Portal account.</p>
        </div>

        <form className="relative z-10 space-y-6" onSubmit={handleReset}>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
          )}
          <div>
            <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <input
              id="reset-password"
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-gray-400 mt-1">At least 8 characters, with a letter and a number.</p>
          </div>

          <div>
            <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
            <input
              id="reset-confirm-password"
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-60"
          >
            {isSubmitting ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
