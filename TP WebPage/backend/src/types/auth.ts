export type AppRole = 'admin' | 'facilitator' | 'trainee';

export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  role: AppRole;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  tokenId: string; // refresh_tokens.id, so it can be looked up/revoked server-side
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AppRole;
  permissions: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
