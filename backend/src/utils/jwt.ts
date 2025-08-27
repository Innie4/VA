import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';
import { config } from '../config/config';
import { logger } from './logger';

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  tier?: string;
  isEmailVerified: boolean;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate access and refresh tokens for a user
 */
export const generateTokens = (payload: {
  id: string;
  email: string;
  role: string;
  tier?: string;
  isEmailVerified: boolean;
  permissions?: string[];
}): TokenPair => {
  try {
    const accessTokenOptions: SignOptions = {
      expiresIn: config.jwt.accessExpiry as StringValue,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    };

    const accessToken = jwt.sign(
      {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        tier: payload.tier,
        isEmailVerified: payload.isEmailVerified,
        permissions: payload.permissions,
        type: 'access'
      },
      config.jwt.accessSecret,
      accessTokenOptions
    );

    const refreshTokenOptions: SignOptions = {
      expiresIn: config.jwt.refreshExpiry as StringValue,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    };

    const refreshToken = jwt.sign(
      {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        tier: payload.tier,
        isEmailVerified: payload.isEmailVerified,
        permissions: payload.permissions,
        type: 'refresh'
      },
      config.jwt.refreshSecret,
      refreshTokenOptions
    );

    return { accessToken, refreshToken };
  } catch (error) {
    logger.error('Error generating tokens:', error);
    throw new Error('Failed to generate tokens');
  }
};

/**
 * Verify and decode an access token
 */
export const verifyAccessToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as JwtPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('Invalid access token:', error.message);
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Access token expired:', error.message);
    } else {
      logger.error('Error verifying access token:', error);
    }
    return null;
  }
};

/**
 * Verify and decode a refresh token
 */
export const verifyRefreshToken = (token: string): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as { userId: string };

    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('Invalid refresh token:', error.message);
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Refresh token expired:', error.message);
    } else {
      logger.error('Error verifying refresh token:', error);
    }
    return null;
  }
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] || null;
};

/**
 * Get token expiration time in seconds
 */
export const getTokenExpiration = (token: string): number | null => {
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    return decoded?.exp || null;
  } catch (error) {
    logger.error('Error decoding token for expiration:', error);
    return null;
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  const exp = getTokenExpiration(token);
  if (!exp) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  return exp < now;
};

/**
 * Get time until token expires (in seconds)
 */
export const getTimeUntilExpiration = (token: string): number | null => {
  const exp = getTokenExpiration(token);
  if (!exp) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const timeLeft = exp - now;
  return timeLeft > 0 ? timeLeft : 0;
};

/**
 * Generate a secure random token for email verification, password reset, etc.
 */
export const generateSecureToken = (length: number = 32): string => {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Create a JWT token for email verification
 */
export const generateEmailVerificationToken = (userId: string, email: string): string => {
  try {
    return jwt.sign(
      { userId, email, type: 'email_verification' },
      config.jwt.accessSecret,
      {
        expiresIn: '24h',
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }
    );
  } catch (error) {
    logger.error('Error generating email verification token:', error);
    throw new Error('Failed to generate email verification token');
  }
};

/**
 * Verify email verification token
 */
export const verifyEmailVerificationToken = (token: string): { userId: string; email: string } | null => {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as { userId: string; email: string; type: string };

    if (decoded.type !== 'email_verification') {
      return null;
    }

    return { userId: decoded.userId, email: decoded.email };
  } catch (error) {
    logger.debug('Invalid email verification token:', error);
    return null;
  }
};

/**
 * Create a JWT token for password reset
 */
export const generatePasswordResetToken = (userId: string, email: string): string => {
  try {
    return jwt.sign(
      { userId, email, type: 'password_reset' },
      config.jwt.accessSecret,
      {
        expiresIn: '1h',
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      }
    );
  } catch (error) {
    logger.error('Error generating password reset token:', error);
    throw new Error('Failed to generate password reset token');
  }
};

/**
 * Verify password reset token
 */
export const verifyPasswordResetToken = (token: string): { userId: string; email: string } | null => {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as { userId: string; email: string; type: string };

    if (decoded.type !== 'password_reset') {
      return null;
    }

    return { userId: decoded.userId, email: decoded.email };
  } catch (error) {
    logger.debug('Invalid password reset token:', error);
    return null;
  }
};