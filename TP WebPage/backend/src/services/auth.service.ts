import crypto from 'crypto';
import { config } from '../config';
import { prisma } from '../prisma/client';
import { getEmailProvider } from './email';
import { AppRole } from '../types/auth';
import { ApiError } from '../utils/ApiError';
import { sha256 } from '../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { hashPassword, verifyPassword } from '../utils/password';

const DAY_MS = 24 * 60 * 60 * 1000;
const INVITE_TTL_MS = 7 * DAY_MS;

function userWithRoleInclude() {
  return {
    role: { include: { permissions: { include: { permission: true } } } },
    profile: true
  } as const;
}

type UserWithRole = Awaited<ReturnType<typeof findUserByEmail>>;

async function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
    include: userWithRoleInclude()
  });
}

function toPublicUser(user: NonNullable<UserWithRole>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name as AppRole,
    permissions: user.role.permissions.map((rp) => rp.permission.key),
    isActive: user.isActive,
    profile: user.profile
  };
}

async function issueTokenPair(userId: string, email: string, role: AppRole, rememberMe: boolean) {
  const accessToken = signAccessToken({ sub: userId, email, role });

  const ttlDays = rememberMe ? config.refreshToken.rememberTtlDays : config.refreshToken.ttlDays;
  const ttlMs = ttlDays * DAY_MS;
  const expiresAt = new Date(Date.now() + ttlMs);

  const tokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: userId, tokenId }, Math.floor(ttlMs / 1000));

  await prisma.refreshToken.create({
    data: { id: tokenId, userId, tokenHash: sha256(refreshToken), rememberMe, expiresAt }
  });

  return { accessToken, refreshToken, refreshTokenMaxAgeMs: ttlMs };
}

export async function login(email: string, password: string, rememberMe: boolean) {
  const user = await findUserByEmail(email);
  if (!user || user.deletedAt || !user.isActive) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw ApiError.locked(`Too many failed login attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`);
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    const attempts = user.failedLoginAttempts + 1;
    const lockedOut = attempts >= config.login.maxAttempts;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: lockedOut ? 0 : attempts,
        lockedUntil: lockedOut ? new Date(Date.now() + config.login.lockoutMinutes * 60_000) : null
      }
    });
    throw ApiError.unauthorized('Invalid email or password.');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null }
  });

  const tokens = await issueTokenPair(user.id, user.email, user.role.name as AppRole, rememberMe);
  return { user: toPublicUser(user), ...tokens };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  const tokenHash = sha256(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}

export async function refresh(rawRefreshToken: string | undefined) {
  if (!rawRefreshToken) {
    throw ApiError.unauthorized('Missing refresh token.');
  }

  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw ApiError.unauthorized('Refresh token is invalid or expired.');
  }

  const tokenHash = sha256(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.tokenId } });

  if (!stored || stored.tokenHash !== tokenHash || stored.revokedAt || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Refresh token is invalid or expired.');
  }

  const user = await prisma.user.findUnique({ where: { id: stored.userId }, include: userWithRoleInclude() });
  if (!user || user.deletedAt || !user.isActive) {
    throw ApiError.unauthorized('Account is no longer active.');
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const tokens = await issueTokenPair(user.id, user.email, user.role.name as AppRole, stored.rememberMe);
  return { user: toPublicUser(user), ...tokens };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userWithRoleInclude() });
  if (!user || user.deletedAt || !user.isActive) {
    throw ApiError.unauthorized('Account is no longer active.');
  }
  return toPublicUser(user);
}

// The raw `token` is still returned here — the service layer stays provider-agnostic and fully
// testable. It's the HTTP layer's job (controllers/auth.controller.ts) to decide whether a
// response is allowed to include it; see config.exposeAuthTokens.
export async function createInvite(email: string, role: AppRole, invitedBy: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    throw ApiError.conflict('An account with this email already exists.');
  }

  const roleRow = await prisma.role.findUnique({ where: { name: role } });
  if (!roleRow) {
    throw ApiError.badRequest('Unknown role.');
  }

  await prisma.userInvite.updateMany({
    where: { email: normalizedEmail, status: 'Pending' },
    data: { status: 'Revoked' }
  });

  const token = crypto.randomBytes(32).toString('hex');
  const invite = await prisma.userInvite.create({
    data: {
      email: normalizedEmail,
      roleId: roleRow.id,
      invitedBy,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS)
    }
  });

  await getEmailProvider().send({
    to: invite.email,
    subject: 'You have been invited to Trainee Portal',
    text: `You've been invited to join Trainee Portal. Use this link to set up your account: /invite?token=${token}&email=${encodeURIComponent(invite.email)}\n\nThis link expires ${invite.expiresAt.toISOString()}.`
  });

  return { email: invite.email, expiresAt: invite.expiresAt, token };
}

function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function acceptInvite(token: string, password: string) {
  const invite = await prisma.userInvite.findUnique({ where: { tokenHash: sha256(token) }, include: { role: true } });
  if (!invite || invite.status !== 'Pending' || invite.expiresAt < new Date()) {
    throw ApiError.badRequest('This invite is invalid or has expired.');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: deriveNameFromEmail(invite.email),
        email: invite.email,
        passwordHash,
        roleId: invite.roleId,
        isActive: true
      }
    });
    await tx.userProfile.create({ data: { userId: created.id } });
    await tx.userInvite.update({ where: { id: invite.id }, data: { status: 'Accepted', acceptedAt: new Date() } });
    return created;
  });

  return { role: invite.role.name as AppRole, userId: user.id };
}

// NOTE: unauthenticated by design (matches the existing "forgot password" contract from the mock backend).
// TODO(production): replace with a token-verified reset flow (emailed link) before real deployment.
export async function forgotPassword(email: string, newPassword: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user || user.deletedAt || !user.isActive) {
    throw ApiError.notFound('No active account found for that email.');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    })
  ]);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.unauthorized();
  }

  const matches = await verifyPassword(currentPassword, user.passwordHash);
  if (!matches) {
    throw ApiError.badRequest('Current password is incorrect.');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    })
  ]);
}
