import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create transports
const transports: winston.transport[] = [];

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'info',
    })
  );
}

// File transport for all environments
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: logFormat,
    level: process.env.LOG_LEVEL || 'info',
  })
);

// Error file transport
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat,
    level: 'error',
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'va-backend',
    environment: process.env.NODE_ENV || 'development',
  },
  transports,
  exitOnError: false,
});

// Handle uncaught exceptions and rejections
logger.exceptions.handle(
  new DailyRotateFile({
    filename: path.join(logsDir, 'exceptions-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat,
  })
);

logger.rejections.handle(
  new DailyRotateFile({
    filename: path.join(logsDir, 'rejections-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat,
  })
);

// Add request ID to logs
const addRequestId = (requestId: string) => {
  return logger.child({ requestId });
};

// Performance logging helper
const logPerformance = (operation: string, startTime: number) => {
  const duration = Date.now() - startTime;
  logger.info(`Performance: ${operation} completed in ${duration}ms`);
};

// Database query logging helper
const logDatabaseQuery = (query: string, duration: number, params?: any) => {
  logger.debug('Database Query', {
    query,
    duration: `${duration}ms`,
    params,
  });
};

// API request logging helper
const logApiRequest = (method: string, url: string, statusCode: number, duration: number, userId?: string) => {
  logger.info('API Request', {
    method,
    url,
    statusCode,
    duration: `${duration}ms`,
    userId,
  });
};

// Security event logging
const logSecurityEvent = (event: string, details: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
  logger.warn('Security Event', {
    event,
    severity,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Business logic logging
const logBusinessEvent = (event: string, details: any) => {
  logger.info('Business Event', {
    event,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Error logging with context
const logError = (error: Error, context?: any) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
};

// Stream for Morgan HTTP request logging
const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export {
  logger,
  addRequestId,
  logPerformance,
  logDatabaseQuery,
  logApiRequest,
  logSecurityEvent,
  logBusinessEvent,
  logError,
  morganStream,
  logger as default
};