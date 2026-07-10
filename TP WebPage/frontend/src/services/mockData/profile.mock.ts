import type { Role } from '../../types/role';
import type { RoleProfile } from '../../types/profile';

export const DEFAULT_PROFILES: Record<Role, RoleProfile> = {
  admin: {
    phone: '+91 98765 43210',
    location: 'Hyderabad, India',
    avatarDataUrl: null,
    company: 'TechCorp Solutions',
    department: 'Learning & Development',
    idNumber: 'TC-ADM-0042'
  },
  facilitator: {
    phone: '+91 91234 56780',
    location: 'Bengaluru, India',
    avatarDataUrl: null,
    company: 'TechCorp Solutions',
    department: 'AI ML Training',
    idNumber: 'TC-FAC-0117'
  },
  trainee: {
    phone: '+91 90123 45678',
    location: 'Pune, India',
    avatarDataUrl: null,
    batch: 'BA BTech',
    course: 'Business Analysis',
    idNumber: 'TC-TRN-2114'
  }
};
