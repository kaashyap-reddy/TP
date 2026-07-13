import rateLimit from 'express-rate-limit';

/** Applied to all /api/* traffic — generous enough not to bother normal use, blocks abusive scripting. */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' }
});

/** Applied to login specifically — brute-force credential guessing is the threat here, so it's much stricter. */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Count only failed attempts so a legitimate user retrying a few times isn't punished as hard —
  // the account-lockout check in auth.service handles per-account brute force independently.
  skipSuccessfulRequests: true,
  message: { message: 'Too many login attempts. Please try again later.' }
});

/** Applied to the unauthenticated forgot-password endpoint — same brute-force/enumeration concern as login. */
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many password reset attempts. Please try again later.' }
});
