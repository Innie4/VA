import { Request, Response } from 'express';
import logger from '../utils/logger';

/**
 * 404 Not Found handler middleware
 * This middleware is called when no route matches the request
 */
export const notFoundHandler = (req: Request, res: Response) => {
  const message = `Route ${req.method} ${req.originalUrl} not found`;
  
  logger.warn('404 Not Found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  res.status(404).json({
    success: false,
    error: {
      message,
      statusCode: 404,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    },
  });
};

export default notFoundHandler;