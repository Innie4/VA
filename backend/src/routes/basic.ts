import { Router } from 'express';
import { logger as routeLogger } from '../utils/logger';

const router = Router();

// Health check endpoint
router.get('/health', (req: any, res: any) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API status endpoint
router.get('/status', (req: any, res: any) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    data: {
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100,
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100,
      },
      environment: process.env.NODE_ENV,
    },
  });
});

// Simple test endpoint
router.get('/test', (req: any, res: any) => {
  routeLogger.info('Test endpoint accessed');
  res.json({
    success: true,
    message: 'Backend server is working!',
    timestamp: new Date().toISOString(),
  });
});

export default router;