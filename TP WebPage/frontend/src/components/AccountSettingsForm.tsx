import { ChangeEvent, KeyboardEvent, RefObject, useEffect, useId, useRef, useState } from 'react';
import { changePassword } from '../services/api/authService';
import { updateMe, uploadAvatar, removeAvatar } from '../services/api/userService';
import { useAuthStore } from '../store/authStore';
import { useProfileStore } from '../store/profileStore';
import { useToastStore } from '../store/toastStore';
import { useAvatarUrl } from '../hooks/useAvatarUrl';
import { Role } from '../types/role';
import { ROUTES } from '../constants/routes';
import Button from './Button';
import SavingButton from './SavingButton';
import { Field, ReadOnlyField, inputClass } from './FormField';

// dashboardLabel/dashboardPath are only used by the full-page route (AccountSettingsPage) for
// its back-link and breadcrumb; the rest style this form regardless of where it's rendered.
export const ACCOUNT_SETTINGS_META: Record<
  Role,
  { dashboardLabel: string; dashboardPath: string; roleLabel: string; accentBtn: string; ring: string; idLabel: string }
> = {
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
const MAX_AVATAR_DIMENSION_PX = 4096;
const MIN_PASSWORD_LENGTH = 8;

interface FormState {
  name: string;
  email: string;
  phone: string;
  location: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const FIELD_ORDER: (keyof FormState)[] = ['name', 'email', 'phone', 'location', 'currentPassword', 'newPassword', 'confirmPassword'];

const EYE_ICON = 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M12 15a3 3 0 100-6 3 3 0 000 6z';
const EYE_OFF_ICON =
  'M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88';

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={off ? EYE_OFF_ICON : EYE_ICON} />
    </svg>
  );
}

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: 'current-password' | 'new-password';
  ring: string;
  inputRef: RefObject<HTMLInputElement>;
  onCapsLockChange: (active: boolean) => void;
}

function PasswordInput({ label, value, onChange, error, autoComplete, ring, inputRef, onCapsLockChange }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;

  function handleKeyEvent(e: KeyboardEvent<HTMLInputElement>) {
    onCapsLockChange(e.getModifierState('CapsLock'));
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyEvent}
          onKeyUp={handleKeyEvent}
          placeholder="••••••••"
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={errorId}
          className={`${inputClass(!!error, ring)} pr-10`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 inline-flex items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onClick={() => setVisible((v) => !v)}
        >
          <EyeIcon off={visible} />
        </Button>
      </div>
      {error && (
        <p id={errorId} className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

function checkImageDimensions(file: File, maxDimensionPx: number): Promise<boolean> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img.width <= maxDimensionPx && img.height <= maxDimensionPx);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(false);
    };
    img.src = objectUrl;
  });
}

interface AccountSettingsFormProps {
  // Called when the user cancels out — navigate away for the full-page route, or (when rendered
  // inside SettingsDrawer) run the drawer's dirty-aware close handler.
  onDone: () => void;
  // Lets the drawer shell know whether there are unsaved changes, so it can confirm before
  // discarding them on Escape/overlay-click/close-button/Cancel. Not used by the full-page route.
  onDirtyChange?: (dirty: boolean) => void;
}

export default function AccountSettingsForm({ onDone, onDirtyChange }: AccountSettingsFormProps) {
  const role = useAuthStore((s) => s.role) as Role;
  const authEmail = useAuthStore((s) => s.email);
  const displayName = useAuthStore((s) => s.displayName);
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName);
  const updateEmail = useAuthStore((s) => s.updateEmail);
  const profile = useProfileStore((s) => s.profiles[role]);
  const applyUserProfile = useProfileStore((s) => s.applyUserProfile);
  const showToast = useToastStore((s) => s.showToast);
  const meta = ACCOUNT_SETTINGS_META[role];
  const avatarUrl = useAvatarUrl(profile.avatarStorageKey, profile.avatarUpdatedAt);

  const initialValue: FormState = {
    name: displayName ?? '',
    email: authEmail ?? '',
    phone: profile.phone,
    location: profile.location,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  const [form, setForm] = useState<FormState>(initialValue);
  const [initial, setInitial] = useState<FormState>(initialValue);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const fieldRefs: Record<keyof FormState, RefObject<HTMLInputElement>> = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    phone: useRef<HTMLInputElement>(null),
    location: useRef<HTMLInputElement>(null),
    currentPassword: useRef<HTMLInputElement>(null),
    newPassword: useRef<HTMLInputElement>(null),
    confirmPassword: useRef<HTMLInputElement>(null)
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // "Saved just now" is a transient state indicator, not a permanent label -- clear it a few
  // seconds after a successful save so it doesn't linger and read as stale.
  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(null), 4000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      const message = 'Avatar must be a JPG or PNG image.';
      setAvatarError(message);
      showToast(message, 'error');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      const message = 'Avatar image must be smaller than 1MB.';
      setAvatarError(message);
      showToast(message, 'error');
      return;
    }
    if (!(await checkImageDimensions(file, MAX_AVATAR_DIMENSION_PX))) {
      const message = `Avatar image must be ${MAX_AVATAR_DIMENSION_PX}x${MAX_AVATAR_DIMENSION_PX}px or smaller.`;
      setAvatarError(message);
      showToast(message, 'error');
      return;
    }

    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const updatedUser = await uploadAvatar(file);
      applyUserProfile(role, updatedUser);
      showToast('Profile photo updated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to upload photo.';
      setAvatarError(message);
      showToast(message, 'error');
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const updatedUser = await removeAvatar();
      applyUserProfile(role, updatedUser);
      showToast('Profile photo removed.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to remove photo.';
      setAvatarError(message);
      showToast(message, 'error');
    } finally {
      setAvatarUploading(false);
    }
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errs.email = 'Enter a valid email address.';
    // Phone and location are optional profile details (the demo fixtures and a fresh real
    // account both start with them blank) -- only validate the format once something's entered,
    // rather than forcing every user to fill them in before they can save anything else.
    if (form.phone.trim() && !/^[0-9+()\-\s]{7,15}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number.';
    if (form.newPassword || form.confirmPassword) {
      if (!form.currentPassword) errs.currentPassword = 'Enter your current password to change it.';
      if (form.newPassword.length < MIN_PASSWORD_LENGTH) errs.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
      else if (form.newPassword !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    }
    setErrors(errs);

    if (Object.keys(errs).length > 0) {
      const firstInvalid = FIELD_ORDER.find((key) => errs[key]);
      if (firstInvalid) {
        const el = fieldRefs[firstInvalid].current;
        el?.focus();
        el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      }
    }
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (saving) return; // guards a double-click landing in the gap before `saving` re-renders
    if (!validate()) {
      showToast('Please fix the highlighted fields.', 'error');
      return;
    }

    setSaving(true);

    const trimmed = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), location: form.location.trim() };
    const profilePatch: Partial<typeof trimmed> = {};
    if (trimmed.name !== initial.name) profilePatch.name = trimmed.name;
    if (trimmed.email !== initial.email) profilePatch.email = trimmed.email;
    if (trimmed.phone !== initial.phone) profilePatch.phone = trimmed.phone;
    if (trimmed.location !== initial.location) profilePatch.location = trimmed.location;
    const profileAttempted = Object.keys(profilePatch).length > 0;
    const passwordAttempted = !!form.newPassword;

    let profileError: string | null = null;
    let passwordError: string | null = null;

    // One combined PATCH /users/me call for every changed profile field (name/email/phone/
    // location together) instead of the two separate requests this form used to send.
    if (profileAttempted) {
      try {
        const updatedUser = await updateMe(profilePatch);
        applyUserProfile(role, updatedUser);
        if (profilePatch.name !== undefined) updateDisplayName(profilePatch.name);
        if (profilePatch.email !== undefined) updateEmail(profilePatch.email);
      } catch (err) {
        profileError = err instanceof Error ? err.message : 'Unable to save profile changes.';
      }
    }

    // Password change is a separate, clearly-labelled operation against a different endpoint --
    // it can succeed or fail independently of the profile update above.
    if (passwordAttempted) {
      try {
        await changePassword(form.currentPassword, form.newPassword);
      } catch (err) {
        passwordError = err instanceof Error ? err.message : 'Unable to change password.';
      }
    }

    setSaving(false);

    const profileOk = !profileAttempted || !profileError;
    const passwordOk = !passwordAttempted || !passwordError;

    if (profileOk && passwordOk) {
      const newBaseline: FormState = { ...trimmed, currentPassword: '', newPassword: '', confirmPassword: '' };
      setForm(newBaseline);
      setInitial(newBaseline);
      setSavedAt(Date.now());
      showToast(profileAttempted && passwordAttempted ? 'Account settings and password updated.' : passwordAttempted ? 'Password updated.' : 'Account settings updated.');
      return;
    }

    // Partial failure: whichever half succeeded gets reflected in state so it isn't re-submitted
    // on the next Save click, and the toast names exactly what did and didn't go through.
    if (profileOk && profileAttempted) {
      setForm((f) => ({ ...f, ...trimmed }));
      setInitial((i) => ({ ...i, ...trimmed }));
    }
    if (passwordOk && passwordAttempted) {
      setForm((f) => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }));
      setInitial((i) => ({ ...i, currentPassword: '', newPassword: '', confirmPassword: '' }));
    }

    if (profileError && passwordError) {
      showToast(`Profile update failed: ${profileError} Password change also failed: ${passwordError}`, 'error');
    } else if (profileError) {
      showToast(passwordAttempted ? `Password changed, but profile update failed: ${profileError}` : `Unable to save changes: ${profileError}`, 'error');
    } else if (passwordError) {
      showToast(profileAttempted ? `Profile saved, but password change failed: ${passwordError}` : `Unable to change password: ${passwordError}`, 'error');
    }
  }

  const initialLetter = (form.name || meta.roleLabel).charAt(0).toUpperCase();
  const newPasswordMeetsLength = form.newPassword.length >= MIN_PASSWORD_LENGTH;
  const confirmMatches = form.confirmPassword.length > 0 && form.confirmPassword === form.newPassword;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-500 overflow-hidden ring-4 ring-gray-50">
            {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : initialLetter}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <label
                className={`inline-flex items-center gap-2 px-4 py-2 ${meta.accentBtn} text-white rounded-lg font-medium text-sm cursor-pointer transition-colors ${avatarUploading ? 'opacity-60 pointer-events-none' : ''}`}
              >
                {avatarUploading ? 'Uploading…' : profile.avatarStorageKey ? 'Replace Photo' : 'Change Photo'}
                <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarChange} disabled={avatarUploading} />
              </label>
              {profile.avatarStorageKey && (
                <Button
                  variant="ghost"
                  onClick={handleAvatarRemove}
                  disabled={avatarUploading}
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 font-medium rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2">JPG or PNG, up to 1MB, {MAX_AVATAR_DIMENSION_PX}x{MAX_AVATAR_DIMENSION_PX}px max.</p>
            {avatarError && <p className="text-xs text-red-600 mt-1">{avatarError}</p>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="font-bold text-gray-800 mb-4">Profile Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" error={errors.name}>
            <input ref={fieldRefs.name} value={form.name} onChange={(e) => setField('name', e.target.value)} className={inputClass(!!errors.name, meta.ring)} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input
              ref={fieldRefs.email}
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              className={inputClass(!!errors.email, meta.ring)}
            />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input ref={fieldRefs.phone} value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={inputClass(!!errors.phone, meta.ring)} />
          </Field>
          <Field label="Location" error={errors.location}>
            <input
              ref={fieldRefs.location}
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              className={inputClass(!!errors.location, meta.ring)}
            />
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
        {capsLockOn && (
          <p className="mb-3 text-xs font-medium text-amber-600" role="status">
            Caps Lock is on.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PasswordInput
            label="Current Password"
            value={form.currentPassword}
            onChange={(v) => setField('currentPassword', v)}
            error={errors.currentPassword}
            autoComplete="current-password"
            ring={meta.ring}
            inputRef={fieldRefs.currentPassword}
            onCapsLockChange={setCapsLockOn}
          />
          <div className="hidden sm:block" />
          <div>
            <PasswordInput
              label="New Password"
              value={form.newPassword}
              onChange={(v) => setField('newPassword', v)}
              error={errors.newPassword}
              autoComplete="new-password"
              ring={meta.ring}
              inputRef={fieldRefs.newPassword}
              onCapsLockChange={setCapsLockOn}
            />
            {form.newPassword.length > 0 && (
              <p className={`text-xs mt-1 ${newPasswordMeetsLength ? 'text-green-600' : 'text-gray-400'}`}>
                {newPasswordMeetsLength ? '✓' : '•'} At least {MIN_PASSWORD_LENGTH} characters
              </p>
            )}
          </div>
          <div>
            <PasswordInput
              label="Confirm New Password"
              value={form.confirmPassword}
              onChange={(v) => setField('confirmPassword', v)}
              error={errors.confirmPassword}
              autoComplete="new-password"
              ring={meta.ring}
              inputRef={fieldRefs.confirmPassword}
              onCapsLockChange={setCapsLockOn}
            />
            {form.confirmPassword.length > 0 && (
              <p className={`text-xs mt-1 ${confirmMatches ? 'text-green-600' : 'text-red-600'}`}>{confirmMatches ? '✓ Passwords match' : '✗ Passwords do not match'}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">Leave blank to keep your current password.</p>
      </div>

      <div className="flex items-center justify-end gap-3">
        {savedAt && (
          <span className="text-xs font-medium text-green-600" role="status">
            Saved just now
          </span>
        )}
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <SavingButton
          onClick={handleSave}
          isSaving={saving}
          disabled={!isDirty}
          label="Save Changes"
          savingLabel="Saving…"
          className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 ${meta.accentBtn} text-white rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        />
      </div>
    </div>
  );
}
