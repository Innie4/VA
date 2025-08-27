import { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { db } from '../config/database';

const router = Router();

// Health check endpoint
router.get('/health', async (req: Request, res: Response) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: 'unknown',
      redis: 'unknown'
    }
  };

  try {
    // Check database connection
    await db.getClient().$queryRaw`SELECT 1`;
    healthCheck.services.database = 'healthy';
  } catch (error) {
    logger.error('Database health check failed:', error);
    healthCheck.services.database = 'unhealthy';
  }

  try {
    // Check Redis connection (if configured)
    if (config.REDIS_URL && config.NODE_ENV === 'production') {
      const redis = new Redis(config.REDIS_URL);
      await redis.ping();
      healthCheck.services.redis = 'healthy';
      redis.disconnect();
    } else {
      healthCheck.services.redis = 'skipped';
    }
  } catch (error) {
    logger.error('Redis health check failed:', error);
    healthCheck.services.redis = 'unhealthy';
  }

  // Determine overall health
  const isHealthy = healthCheck.services.database === 'healthy' && 
                   (healthCheck.services.redis === 'healthy' || healthCheck.services.redis === 'skipped');

  const statusCode = isHealthy ? 200 : 503;
  
  res.status(statusCode).json(healthCheck);
});

// Readiness probe
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if the application is ready to serve requests
    await db.getClient().$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Readiness check failed:', error);
    res.status(503).json({ status: 'not ready', timestamp: new Date().toISOString() });
  }
});

// Liveness probe
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if this endpoint responds, the app is alive
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

export default router;