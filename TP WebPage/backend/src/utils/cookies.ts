import { CookieOptions } from 'express';
import { config } from '../config';

export const REFRESH_COOKIE_NAME = 'refreshToken';

export function refreshCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: config.isProduction,
    // Frontend (Vercel) and backend (Railway/Render) are on different registrable domains by
    // default, so the cookie must be sameSite:'none' in production for cross-site fetches to
    // carry it. 'lax' is kept for local dev, where secure:false makes 'none' invalid anyway.
    sameSite: config.isProduction ? 'none' : 'lax',
    signed: true,
    path: '/api/auth',
    maxAge: maxAgeMs
  };
}
