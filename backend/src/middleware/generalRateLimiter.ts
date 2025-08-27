import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient, isRedisAvailable } from '../utils/redis';
import { logger } from '../utils/logger';

/**
 * General rate limiter for all API endpoints
 * Uses Redis for distributed rate limiting across multiple server instances
 */
export const generalRateLimiter = rateLimit({
  store: isRedisAvailable() ? new RedisStore({
    sendCommand: async (...args: string[]) => {
      const [command, ...commandArgs] = args;
      if (!command) throw new Error('Redis command is required');
      const client = getRedisClient();
      if (!client) throw new Error('Redis client not available');
      return await client.call(command, ...commandArgs) as any;
    },
  }) : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
      statusCode: 429,
      retryAfter: '15 minutes',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks and static files
    return req.path === '/health' || req.path.startsWith('/uploads/');
  },
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
    });
    res.status(options.statusCode).json({
      success: false,
      error: {
        message: 'Too many requests from this IP, please try again later.',
        statusCode: 429,
        retryAfter: '15 minutes',
      },
    });
  },
});

export default generalRateLimiter;