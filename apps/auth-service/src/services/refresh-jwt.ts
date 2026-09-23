import jwt from 'jsonwebtoken';
import { UserRole } from '@payrollpro/shared-types';

/**
 * Refresh tokens are signed/verified with a dedicated secret so access-token
 * key rotation does not invalidate refresh sessions (and vice versa).
 * Auth-only module: [REVIEW MANUALLY BEFORE PROD]
 */
let refreshJwtSecret: string | null = null;

export function setRefreshJwtSecret(secret: string): void {
  refreshJwtSecret = secret;
}

export function getRefreshJwtSecret(): string {
  if (!refreshJwtSecret) {
    throw new Error('Missing required environment variable: JWT_REFRESH_SECRET');
  }
  return refreshJwtSecret;
}

export interface RefreshTokenPayload {
  id: string;
  email: string;
  role: UserRole;
  type: 'refresh';
  jti: string;
}

export function signRefreshToken(
  payload: Omit<RefreshTokenPayload, 'type'>,
  expiresIn: string = process.env.JWT_REFRESH_EXPIRATION || '7d',
): string {
  return jwt.sign({ ...payload, type: 'refresh' }, getRefreshJwtSecret(), {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, getRefreshJwtSecret()) as RefreshTokenPayload;
  if (decoded.type !== 'refresh' || !decoded.jti || !decoded.id) {
    throw new Error('Invalid refresh token');
  }
  return decoded;
}
