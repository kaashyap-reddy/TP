import { FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { acceptInvite } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { writeSession } from '../lib/authSession';

const pageBackground = { background: 'linear-gradient(135deg, #f0f4f8 0%, #e0eaf5 100%)' };
const glassCard = {
  background: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
};

export default function InvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteEmail = searchParams.get('email') ?? '';
  const setSession = useAuthStore((s) => s.setSession);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSetup(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const { role } = await acceptInvite(inviteEmail, password);
      const displayName = inviteEmail.split('@')[0].replace(/\b\w/g, (c) => c.toUpperCase());
      setSession({ email: inviteEmail, role, displayName });
      writeSession({ email: inviteEmail, role, displayName }, true);
      navigate('/trainee');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to activate account.');
    }
  }

  if (!inviteEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={pageBackground}>
        <div className="glass-card w-full max-w-md rounded-2xl p-8 text-center relative overflow-hidden" style={glassCard}>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Invalid Invite Link</h1>
          <p className="text-gray-500 mb-6">This invite link is missing or malformed. Ask your admin or facilitator to resend it.</p>
          <a href="/" className="text-blue-600 hover:underline font-medium">‹ Back to Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={pageBackground}>
      <div className="glass-card w-full max-w-md rounded-2xl p-8 relative overflow-hidden" style={glassCard}>
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-green-500 rounded-full mix-blend-multiply filter blur-2xl opacity-50"></div>
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-blue-300 rounded-full mix-blend-multiply filter blur-2xl opacity-50"></div>

        <div className="relative z-10 text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">You're Invited!</h1>
          <p className="text-gray-500 mt-2">Set a password to activate your Trainee account.</p>
        </div>

        <form className="relative z-10 space-y-6" onSubmit={handleSetup}>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Email (Read Only)</label>
            <input
              type="email"
              value={inviteEmail}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 outline-none"
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Create Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
            <input
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/30"
          >
            Activate Account & Log In
          </button>
        </form>
      </div>
    </div>
  );
}
