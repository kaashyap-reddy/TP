import { ChangeEvent, ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Role } from '../api/auth';
import { resetPassword } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { useToastStore } from '../store/toastStore';
import { updateStoredSession } from '../utils/authSession';
import SavingButton from '../components/SavingButton';
import Breadcrumbs from '../components/Breadcrumbs';
import { ROUTES } from '../constants/routes';

const ROLE_META: Record<Role, { dashboardLabel: string; dashboardPath: string; roleLabel: string; accentBtn: string; ring: string; idLabel: string }> = {
  admin: {
    dashboardLabel: 'Admin Dashboard',
    dashboardPath: ROUTES.ADMIN,
    roleLabel: 'System Administrator',
    accentBtn: 'bg-blue-600 hover:bg-blue-700',
    ring: 'focus:ring-blue-500',
    idLabel: 'Employee ID'
  },
  facilitator: {
    dashboardLabel: 'Facilitator Dashboard',
    dashboardPath: ROUTES.FACILITATOR,
    roleLabel: 'Facilitator',
    accentBtn: 'bg-purple-600 hover:bg-purple-700',
    ring: 'focus:ring-purple-500',
    idLabel: 'Employee ID'
  },
  trainee: {
    dashboardLabel: 'Trainee Dashboard',
    dashboardPath: ROUTES.TRAINEE,
    roleLabel: 'Trainee',
    accentBtn: 'bg-blue-600 hover:bg-blue-700',
    ring: 'focus:ring-blue-500',
    idLabel: 'Trainee ID'
  }
};

const MAX_AVATAR_BYTES = 1_000_000;

interface FormState {
  name: string;
  email: string;
  phone: string;
  location: string;
  newPassword: string;
  confirmPassword: string;
}

function inputClass(hasError: boolean, ring: string) {
  return `w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 ${ring} transition-colors ${hasError ? 'border-red-400' : 'border-gray-300'}`;
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type="text" value={value ?? '—'} readOnly className="w-full px-3 py-2 border rounded-lg outline-none bg-gray-50 text-gray-500" />
    </div>
  );
}

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role) as Role;
  const authEmail = useAuthStore((s) => s.email);
  const displayName = useAuthStore((s) => s.displayName);
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName);
  const updateEmail = useAuthStore((s) => s.updateEmail);
  const profile = useProfileStore((s) => s.profiles[role]);
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const showToast = useToastStore((s) => s.showToast);
  const meta = ROLE_META[role];

  const [form, setForm] = useState<FormState>({
    name: displayName ?? '',
    email: authEmail ?? '',
    phone: profile.phone,
    location: profile.location,
    newPassword: '',
    confirmPassword: ''
  });
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarDataUrl);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showToast('Image must be smaller than 1MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    if (!/^[0-9+()\-\s]{7,15}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number.';
    if (!form.location.trim()) errs.location = 'Location is required.';
    if (form.newPassword || form.confirmPassword) {
      if (form.newPassword.length < 6) errs.newPassword = 'Password must be at least 6 characters.';
      else if (form.newPassword !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (form.newPassword) {
        await resetPassword(form.email.trim(), form.newPassword);
      }
      updateDisplayName(form.name.trim());
      updateEmail(form.email.trim());
      updateProfile(role, { phone: form.phone.trim(), location: form.location.trim(), avatarDataUrl: avatarPreview });
      updateStoredSession({ displayName: form.name.trim(), email: form.email.trim() });
      setForm((f) => ({ ...f, newPassword: '', confirmPassword: '' }));
      showToast('Account settings updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save changes.', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    navigate(meta.dashboardPath);
  }

  const initial = (form.name || meta.roleLabel).charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 px-8 py-5">
        <button onClick={handleCancel} className="text-sm text-blue-600 hover:underline font-medium mb-3">
          ‹ Back to {meta.dashboardLabel}
        </button>
        <Breadcrumbs trail={[meta.dashboardLabel, 'Account Settings']} />
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your profile information and security preferences.</p>
      </header>

      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-500 overflow-hidden ring-4 ring-gray-50">
              {avatarPreview ? <img src={avatarPreview} alt="" className="w-full h-full object-cover" /> : initial}
            </div>
            <div>
              <label className={`inline-block px-4 py-2 ${meta.accentBtn} text-white rounded-lg font-medium text-sm cursor-pointer transition-colors`}>
                Change Photo
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
              {avatarPreview && (
                <button onClick={() => setAvatarPreview(null)} className="ml-3 text-sm text-gray-500 hover:text-red-600 font-medium">
                  Remove
                </button>
              )}
              <p className="text-xs text-gray-400 mt-2">JPG or PNG, up to 1MB.</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-gray-800 mb-4">Profile Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" error={errors.name}>
              <input value={form.name} onChange={(e) => setField('name', e.target.value)} className={inputClass(!!errors.name, meta.ring)} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className={inputClass(!!errors.email, meta.ring)} />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={inputClass(!!errors.phone, meta.ring)} />
            </Field>
            <Field label="Location" error={errors.location}>
              <input value={form.location} onChange={(e) => setField('location', e.target.value)} className={inputClass(!!errors.location, meta.ring)} />
            </Field>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-gray-800 mb-4">{role === 'trainee' ? 'Batch Details' : 'Company Details'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {role === 'admin' && (
              <>
                <ReadOnlyField label="Company" value={profile.company} />
                <ReadOnlyField label="Department" value={profile.department} />
                <ReadOnlyField label={meta.idLabel} value={profile.idNumber} />
              </>
            )}
            {role === 'facilitator' && (
              <>
                <ReadOnlyField label="Department" value={profile.department} />
                <ReadOnlyField label={meta.idLabel} value={profile.idNumber} />
              </>
            )}
            {role === 'trainee' && (
              <>
                <ReadOnlyField label="Batch" value={profile.batch} />
                <ReadOnlyField label="Course" value={profile.course} />
                <ReadOnlyField label={meta.idLabel} value={profile.idNumber} />
              </>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-4">These details are managed by your organization. Contact an administrator to update them.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="font-bold text-gray-800 mb-4">Change Password</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="New Password" error={errors.newPassword}>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => setField('newPassword', e.target.value)}
                placeholder="••••••••"
                className={inputClass(!!errors.newPassword, meta.ring)}
              />
            </Field>
            <Field label="Confirm New Password" error={errors.confirmPassword}>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setField('confirmPassword', e.target.value)}
                placeholder="••••••••"
                className={inputClass(!!errors.confirmPassword, meta.ring)}
              />
            </Field>
          </div>
          <p className="text-xs text-gray-400 mt-2">Leave blank to keep your current password.</p>
        </div>

        <div className="flex justify-end gap-3 pb-8">
          <button onClick={handleCancel} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium border border-gray-200">
            Cancel
          </button>
          <SavingButton
            onClick={handleSave}
            isSaving={saving}
            label="Save Changes"
            savingLabel="Saving…"
            className={`px-5 py-2.5 ${meta.accentBtn} text-white rounded-lg font-medium shadow-sm`}
          />
        </div>
      </div>
    </div>
  );
}
