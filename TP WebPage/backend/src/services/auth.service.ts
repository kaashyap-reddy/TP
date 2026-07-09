import { Role, User } from '../types/user';

const users: User[] = [
  { email: 'admin@company.com', password: 'password123', role: 'admin', active: true },
  { email: 'facilitator@company.com', password: 'password123', role: 'facilitator', active: true },
  { email: 'trainee@company.com', password: 'invite-pending', role: 'trainee', active: false }
];

export function login(email: string, password: string): { role: Role } | null {
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.active || user.password !== password) {
    return null;
  }
  return { role: user.role };
}

export function acceptInvite(email: string, password: string): { role: Role } | null {
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.role === 'trainee');
  if (!user) {
    return null;
  }
  user.password = password;
  user.active = true;
  return { role: user.role };
}

export function resetPassword(email: string, newPassword: string): { role: Role } | null {
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.active);
  if (!user) {
    return null;
  }
  user.password = newPassword;
  return { role: user.role };
}

export function createInvite(email: string): { email: string } | null {
  const normalized = email.toLowerCase();
  const existing = users.find((u) => u.email.toLowerCase() === normalized);
  if (existing) {
    if (existing.role !== 'trainee') {
      return null;
    }
    existing.active = false;
    existing.password = 'invite-pending';
    return { email: existing.email };
  }
  users.push({ email, password: 'invite-pending', role: 'trainee', active: false });
  return { email };
}
