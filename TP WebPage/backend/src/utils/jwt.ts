import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { AccessTokenPayload, RefreshTokenPayload } from '../types/auth';

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = { expiresIn: config.jwt.accessExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwt.accessSecret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
}

export function signRefreshToken(payload: RefreshTokenPayload, expiresInSeconds: number): string {
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: expiresInSeconds });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
}
