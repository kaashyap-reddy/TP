import bcrypt from 'bcrypt';
import { config } from '../config';

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.bcryptSaltRounds);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
