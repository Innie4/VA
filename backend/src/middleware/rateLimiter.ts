import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { AppError } from './errorHandler';

// Rate limiter configuration
interface RateLimiterConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

// Default key generator (IP + User ID if available)
const defaultKeyGenerator = (req: Request): string => {
  const userId = (req as any).user?.id;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return userId ? `${ip}:${userId}` : ip;
};

// Skip function for health checks and static assets
const defaultSkip = (req: Request): boolean => {
  const skipPaths = ['/api/health', '/favicon.ico', '/robots.txt'];
  return skipPaths.some(path => req.path.startsWith(path));
};

// Rate limit exceeded handler
const rateLimitHandler = (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const ip = req.ip || 'unknown';
  
  logger.warn('Rate limit exceeded', {
    ip,
    userId,
    path: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
  });
  
  const error = new AppError(
    'Too many requests, please try again later',
    429,
    true,
    'RATE_LIMIT_EXCEEDED'
  );
  
  res.status(429).json({
    success: false,
    message: error.message,
    error: {
      code: error.code,
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000),
    },
    timestamp: new Date().toISOString(),
  });
};

// General rate limiter
export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: defaultKeyGenerator,
  skip: defaultSkip,
  handler: rateLimitHandler,
});

// Strict rate limiter for sensitive endpoints
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many requests for this sensitive operation',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: defaultKeyGenerator,
  handler: rateLimitHandler,
});

// Auth rate limiter (for login/register)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use email/username if provided, otherwise IP
    const identifier = req.body?.email || req.body?.username || req.ip;
    return identifier;
  },
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: rateLimitHandler,
});

// Password reset rate limiter
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: 'Too many password reset attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = req.body?.email || req.ip;
    return email;
  },
  handler: rateLimitHandler,
});

// API rate limiter for authenticated users
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window for authenticated users
  message: 'API rate limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: defaultKeyGenerator,
  skip: (req: Request) => {
    // Skip if not authenticated
    return !(req as any).user;
  },
  handler: rateLimitHandler,
});

// File upload rate limiter
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per window
  message: 'Too many file uploads, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: defaultKeyGenerator,
  handler: rateLimitHandler,
});

// Chat message rate limiter
export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: 'Too many messages, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: defaultKeyGenerator,
  handler: rateLimitHandler,
});

// Slow down middleware for progressive delays
export const slowDownMiddleware = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per window at full speed
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
  keyGenerator: defaultKeyGenerator,
  skip: defaultSkip,
});

// Create custom rate limiter
export const createRateLimiter = (config: RateLimiterConfig) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message || 'Rate limit exceeded',
    standardHeaders: config.standardHeaders ?? true,
    legacyHeaders: config.legacyHeaders ?? false,
    skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
    skipFailedRequests: config.skipFailedRequests ?? false,
    keyGenerator: config.keyGenerator || defaultKeyGenerator,
    skip: config.skip || defaultSkip,
    handler: rateLimitHandler,
  });
};

// Rate limiter for different user tiers
export const createTieredRateLimiter = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req: Request) => {
      const user = (req as any).user;
      if (!user) return 100; // Anonymous users
      
      // Adjust limits based on user tier/subscription
      switch (user.tier) {
        case 'premium':
          return 5000;
        case 'pro':
          return 2000;
        case 'basic':
          return 500;
        default:
          return 200;
      }
    },
    keyGenerator: defaultKeyGenerator,
    handler: rateLimitHandler,
  });
};

// WebSocket rate limiter (for Socket.IO)
export const createSocketRateLimiter = (maxEvents: number = 100, windowMs: number = 60000) => {
  const clients = new Map<string, { count: number; resetTime: number }>();
  
  return (socket: any, next: (err?: Error) => void) => {
    const clientId = socket.handshake.address;
    const now = Date.now();
    
    let clientData = clients.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      clientData = {
        count: 0,
        resetTime: now + windowMs,
      };
      clients.set(clientId, clientData);
    }
    
    clientData.count++;
    
    if (clientData.count > maxEvents) {
      logger.warn('Socket rate limit exceeded', {
        clientId,
        count: clientData.count,
        maxEvents,
      });
      
      return next(new Error('Rate limit exceeded'));
    }
    
    next();
  };
};

// Cleanup function for socket rate limiter
export const cleanupSocketRateLimiter = (clients: Map<string, any>) => {
  const now = Date.now();
  for (const [clientId, data] of clients.entries()) {
    if (now > data.resetTime) {
      clients.delete(clientId);
    }
  }
};

// Create admin rate limiter
export const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 admin requests per window
  message: 'Too many admin requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: defaultKeyGenerator,
  handler: rateLimitHandler,
});

export { generalRateLimiter } from './generalRateLimiter';

export default rateLimiter;