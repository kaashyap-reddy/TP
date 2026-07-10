import type { Role } from './role';

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
}
