export type Role = 'admin' | 'facilitator' | 'trainee';

export interface User {
  email: string;
  password: string;
  role: Role;
  active: boolean;
}
