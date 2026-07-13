import { z } from 'zod';

// Applied to every NEW password (invite acceptance, reset, change) — not to login, which must
// keep accepting whatever was valid when the password was originally set.
export const passwordPolicy = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.') // bcrypt silently truncates beyond this
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, 'Password is required.'),
  rememberMe: z.boolean().optional().default(false)
});

export const createInviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['admin', 'facilitator', 'trainee']).optional().default('trainee')
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required.'),
  password: passwordPolicy
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
  newPassword: passwordPolicy
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: passwordPolicy
});
