import { describe, expect, it } from 'vitest';
import { passwordPolicy } from '../validators/auth.validator';

describe('passwordPolicy', () => {
  it('rejects passwords shorter than 8 characters', () => {
    expect(passwordPolicy.safeParse('Ab1').success).toBe(false);
  });

  it('rejects passwords with no number', () => {
    expect(passwordPolicy.safeParse('abcdefgh').success).toBe(false);
  });

  it('rejects passwords with no letter', () => {
    expect(passwordPolicy.safeParse('12345678').success).toBe(false);
  });

  it('rejects passwords over 72 characters (bcrypt truncation)', () => {
    expect(passwordPolicy.safeParse('a1'.repeat(40)).success).toBe(false);
  });

  it('accepts a reasonable password', () => {
    expect(passwordPolicy.safeParse('Password123').success).toBe(true);
  });
});
