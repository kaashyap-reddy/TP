export interface RoleProfile {
  phone: string;
  location: string;
  avatarStorageKey: string | null;
  avatarUpdatedAt: string | null;
  company?: string;
  department?: string;
  idNumber?: string;
  batch?: string;
  course?: string;
}
