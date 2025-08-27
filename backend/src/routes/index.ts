import { Router } from 'express';
import authRoutes from './auth';
import chatRoutes from './chat';
import userRoutes from './users';
import fileRoutes from './files';
import adminRoutes from './admin';
import healthRoutes from './health';
import { logger } from '../utils/logger';
// import { apiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Mount health routes (no rate limiting for health checks)
router.use('/', healthRoutes);

// API status endpoint
router.get('/status', /* apiRateLimiter, */ (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    data: {
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
      },
      nodeVersion: process.version,
    },
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/chat', chatRoutes);
router.use('/users', userRoutes);
router.use('/files', fileRoutes);
router.use('/admin', adminRoutes);

// Log route registration
logger.info('API routes registered', {
  routes: [
    '/api/health',
    '/api/status',
    '/api/auth/*',
    '/api/chat/*',
    '/api/users/*',
    '/api/files/*',
    '/api/admin/*',
  ],
});

export default router;