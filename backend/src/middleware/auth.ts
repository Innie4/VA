import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';
import { logger } from '../utils/logger';
import { AppError, createAuthError, createForbiddenError } from './errorHandler';
import { config } from '../config/config';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        tier?: string;
        isEmailVerified: boolean;
        permissions?: string[];
      };
    }
  }
}

// JWT payload interface
interface JWTPayload {
  id: string;
  email: string;
  role: string;
  tier?: string;
  isEmailVerified: boolean;
  permissions?: string[];
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

// Extract token from request
const extractToken = (req: Request): string | null => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check cookies
  const cookieToken = req.cookies?.accessToken;
  if (cookieToken) {
    return cookieToken;
  }
  
  // Check query parameter (for WebSocket handshake)
  const queryToken = req.query?.token as string;
  if (queryToken) {
    return queryToken;
  }
  
  return null;
};

// Verify JWT token
const verifyToken = (token: string, secret: string): Promise<JWTPayload> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as JWTPayload);
      }
    });
  });
};

// Main authentication middleware
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      throw createAuthError('Access token is required');
    }
    
    const decoded = await verifyToken(token, config.jwt.accessSecret);
    
    // Verify token type
    if (decoded.type !== 'access') {
      throw createAuthError('Invalid token type');
    }
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      throw createAuthError('Token has expired');
    }
    
    // Attach user to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      ...(decoded.tier && { tier: decoded.tier }),
      isEmailVerified: decoded.isEmailVerified,
      ...(decoded.permissions && { permissions: decoded.permissions }),
    };
    
    // Log successful authentication
    logger.info('User authenticated', {
      userId: req.user!.id,
      email: req.user!.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      return next(createAuthError('Invalid token'));
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Expired JWT token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      return next(createAuthError('Token has expired'));
    }
    
    logger.error('Authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
    next(error);
  }
};

// Optional authentication middleware (doesn't throw if no token)
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      return next(); // Continue without authentication
    }
    
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next(); // Continue without authentication
    }
    
    const decoded = await verifyToken(token, jwtSecret);
    
    if (decoded.type === 'access') {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        ...(decoded.tier && { tier: decoded.tier }),
        isEmailVerified: decoded.isEmailVerified,
        ...(decoded.permissions && { permissions: decoded.permissions }),
      };
    }
    
    next();
  } catch (error) {
    // Log but don't throw - continue without authentication
    logger.debug('Optional authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
    });
    next();
  }
};

// Role-based authorization middleware
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createAuthError('Authentication required'));
    }
    
    if (!roles.includes(req.user.role)) {
      logger.warn('Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        path: req.path,
        method: req.method,
      });
      
      return next(createForbiddenError('Insufficient permissions'));
    }
    
    next();
  };
};

// Permission-based authorization middleware
export const requirePermission = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createAuthError('Authentication required'));
    }
    
    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission)
    );
    
    if (!hasPermission) {
      logger.warn('Missing required permission', {
        userId: req.user.id,
        userPermissions,
        requiredPermissions: permissions,
        path: req.path,
        method: req.method,
      });
      
      return next(createForbiddenError('Missing required permission'));
    }
    
    next();
  };
};

// Email verification middleware
export const requireEmailVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    return next(createAuthError('Authentication required'));
  }
  
  if (!req.user.isEmailVerified) {
    logger.warn('Email verification required', {
      userId: req.user.id,
      email: req.user.email,
    });
    
    return next(createForbiddenError('Email verification required'));
  }
  
  next();
};

// Admin only middleware
export const adminOnly = authorize('admin', 'super_admin');

// Moderator or admin middleware
export const moderatorOrAdmin = authorize('moderator', 'admin', 'super_admin');

// User owns resource middleware
export const requireOwnership = (resourceIdParam: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(createAuthError('Authentication required'));
    }
    
    const resourceId = req.params[resourceIdParam];
    const userId = req.user.id;
    
    // Allow admins to access any resource
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }
    
    // Check if user owns the resource
    if (resourceId !== userId) {
      logger.warn('Resource ownership violation', {
        userId,
        resourceId,
        path: req.path,
        method: req.method,
      });
      
      return next(createForbiddenError('Access denied: resource ownership required'));
    }
    
    next();
  };
};

// Rate limit by user tier
export const tierBasedRateLimit = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next();
    }
    
    // Set rate limit headers based on user tier
    const tier = req.user.tier || 'basic';
    let limit: number;
    
    switch (tier) {
      case 'premium':
        limit = 5000;
        break;
      case 'pro':
        limit = 2000;
        break;
      case 'basic':
        limit = 500;
        break;
      default:
        limit = 200;
    }
    
    res.setHeader('X-RateLimit-Tier', tier);
    res.setHeader('X-RateLimit-Limit', limit.toString());
    
    next();
  };
};

// Socket.IO authentication middleware
export const authenticateSocket = async (socket: any, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next(new Error('Authentication configuration error'));
    }
    
    const decoded = await verifyToken(token, jwtSecret);
    
    if (decoded.type !== 'access') {
      return next(new Error('Invalid token type'));
    }
    
    // Attach user to socket
    socket.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      ...(decoded.tier && { tier: decoded.tier }),
      isEmailVerified: decoded.isEmailVerified,
      ...(decoded.permissions && { permissions: decoded.permissions }),
    };
    
    logger.info('Socket authenticated', {
      userId: socket.user.id,
      socketId: socket.id,
      ip: socket.handshake.address,
    });
    
    next();
  } catch (error) {
    logger.warn('Socket authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      socketId: socket.id,
      ip: socket.handshake.address,
    });
    
    next(new Error('Authentication failed'));
  }
};

// Generate JWT tokens
export const generateTokens = (user: {
  id: string;
  email: string;
  role: string;
  tier?: string;
  isEmailVerified: boolean;
  permissions?: string[];
}) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    tier: user.tier,
    isEmailVerified: user.isEmailVerified,
    permissions: user.permissions,
  };
  
  const accessTokenOptions: SignOptions = {
    expiresIn: config.jwt.accessExpiry as StringValue,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience
  };
  
  const accessToken = jwt.sign(
    { ...payload, type: 'access' },
    config.jwt.accessSecret,
    accessTokenOptions
  );
  
  const refreshTokenOptions: SignOptions = {
    expiresIn: config.jwt.refreshExpiry as StringValue,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience
  };
  
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwt.refreshSecret,
    refreshTokenOptions
  );
  
  return { accessToken, refreshToken };
};

// Verify refresh token
export const verifyRefreshToken = async (token: string): Promise<JWTPayload> => {
  return verifyToken(token, config.jwt.refreshSecret);
};

export default authenticate;