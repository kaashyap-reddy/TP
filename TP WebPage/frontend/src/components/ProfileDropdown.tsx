import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Role } from '../types/role';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { useClickOutside } from '../hooks/useClickOutside';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { ROUTES } from '../constants/routes';

const ACCOUNT_SETTINGS_ROUTE: Record<Role, string> = {
  admin: ROUTES.ADMIN_ACCOUNT_SETTINGS,
  facilitator: ROUTES.FACILITATOR_ACCOUNT_SETTINGS,
  trainee: ROUTES.TRAINEE_ACCOUNT_SETTINGS
};

interface ProfileDropdownProps {
  role: Role;
  onSignOut: () => void;
  forceClose?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const ROLE_STYLES: Record<Role, { label: string; buttonBg: string; buttonRing: string; focusRing: string; gradient: string; accentText: string }> = {
  admin: {
    label: 'System Administrator',
    buttonBg: 'bg-blue-600',
    buttonRing: 'hover:ring-blue-300',
    focusRing: 'focus:ring-blue-500',
    gradient: 'from-blue-600 via-blue-700 to-indigo-800',
    accentText: 'text-blue-100'
  },
  facilitator: {
    label: 'Facilitator',
    buttonBg: 'bg-purple-600',
    buttonRing: 'hover:ring-purple-300',
    focusRing: 'focus:ring-purple-500',
    gradient: 'from-purple-600 via-purple-700 to-indigo-800',
    accentText: 'text-purple-100'
  },
  trainee: {
    label: 'Trainee',
    buttonBg: 'bg-blue-600',
    buttonRing: 'hover:ring-blue-300',
    focusRing: 'focus:ring-blue-500',
    gradient: 'from-blue-600 via-blue-700 to-indigo-800',
    accentText: 'text-blue-100'
  }
};

const ROLE_DEFAULT_NAME: Record<Role, string> = {
  admin: 'Admin User',
  facilitator: 'Facilitator',
  trainee: 'Trainee'
};

const ROLE_DEFAULT_EMAIL: Record<Role, string> = {
  admin: 'admin@company.com',
  facilitator: 'facilitator@company.com',
  trainee: 'trainee@company.com'
};

function DetailRow({ label, value, last }: { label: string; value?: string; last?: boolean }) {
  return (
    <div className={`flex justify-between ${last ? '' : 'mb-1.5'}`}>
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value ?? '—'}</span>
    </div>
  );
}

export default function ProfileDropdown({ role, onSignOut, forceClose, onOpenChange }: ProfileDropdownProps) {
  const navigate = useNavigate();
  const email = useAuthStore((s) => s.email);
  const displayName = useAuthStore((s) => s.displayName);
  const profile = useProfileStore((s) => s.profiles[role]);
  const fetchMyProfile = useProfileStore((s) => s.fetchMyProfile);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMyProfile(role);
  }, [role, fetchMyProfile]);

  useClickOutside(menuRef, () => setOpen(false), open);
  useEscapeKey(() => setOpen(false), open);

  useEffect(() => {
    if (forceClose) setOpen(false);
  }, [forceClose]);

  function toggle() {
    setOpen((current) => {
      const next = !current;
      onOpenChange?.(next);
      return next;
    });
  }

  const style = ROLE_STYLES[role];
  const name = displayName ?? ROLE_DEFAULT_NAME[role];
  const initial = name.charAt(0).toUpperCase() || 'U';
  const idLabel = role === 'trainee' ? 'Trainee ID' : 'Employee ID';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={toggle}
        className={`w-9 h-9 ${style.buttonBg} rounded-full flex items-center justify-center text-white font-bold shadow-inner ${style.buttonRing} hover:ring-2 transition-all cursor-pointer focus:outline-none focus:ring-2 ${style.focusRing} overflow-hidden`}
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" className="w-full h-full object-cover" /> : initial}
      </button>
      <div className={`${open ? '' : 'hidden'} absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden`}>
        <div className={`bg-gradient-to-r ${style.gradient} px-5 py-5 text-white relative overflow-hidden`}>
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full"></div>
          <div className="flex items-center space-x-3 relative z-10">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-xl font-bold ring-2 ring-white/30 overflow-hidden">
              {profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="" className="w-full h-full object-cover" /> : initial}
            </div>
            <div>
              <div className="font-bold text-base">{name}</div>
              <div className={`${style.accentText} text-xs`}>{style.label}</div>
              <div className="mt-1.5 inline-flex items-center gap-1 bg-white/15 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                Active now
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-2 text-xs uppercase font-bold tracking-wide">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              Email
            </span>
            <span className="font-medium text-gray-800 truncate max-w-[170px]" title={email ?? ROLE_DEFAULT_EMAIL[role]}>
              {email ?? ROLE_DEFAULT_EMAIL[role]}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-2 text-xs uppercase font-bold tracking-wide">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              Phone
            </span>
            <span className="font-medium text-gray-800">{profile.phone}</span>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              {role === 'trainee' ? 'Batch Details' : 'Company Details'}
            </div>
            {role === 'admin' && (
              <>
                <DetailRow label="Company" value={profile.company} />
                <DetailRow label="Department" value={profile.department} />
                <DetailRow label={idLabel} value={profile.idNumber} />
                <DetailRow label="Location" value={profile.location} last />
              </>
            )}
            {role === 'facilitator' && (
              <>
                <DetailRow label="Department" value={profile.department} />
                <DetailRow label={idLabel} value={profile.idNumber} />
                <DetailRow label="Location" value={profile.location} last />
              </>
            )}
            {role === 'trainee' && (
              <>
                <DetailRow label="Batch" value={profile.batch} />
                <DetailRow label="Course" value={profile.course} />
                <DetailRow label={idLabel} value={profile.idNumber} />
                <DetailRow label="Location" value={profile.location} last />
              </>
            )}
          </div>
        </div>
        <div className="px-4 pb-4 space-y-1">
          <button
            onClick={() => {
              setOpen(false);
              navigate(ACCOUNT_SETTINGS_ROUTE[role]);
            }}
            className="block w-full text-center py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors"
          >
            Account Settings
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="block w-full text-center py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
