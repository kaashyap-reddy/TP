import type { Role } from '../../types/role';

export interface MockUserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  active: boolean;
}

export const MOCK_USERS: MockUserRecord[] = [
  { id: 'user-admin-1', name: 'Admin User', email: 'admin@company.com', password: 'password123', role: 'admin', active: true },
  { id: 'user-facilitator-1', name: 'Junaid Mohammed', email: 'facilitator@company.com', password: 'password123', role: 'facilitator', active: true },
  { id: 'user-trainee-1', name: 'Priya Sharma', email: 'trainee@company.com', password: 'trainee123', role: 'trainee', active: true }
];
