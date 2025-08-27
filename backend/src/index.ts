console.log('=== SERVER STARTING ===');

import express from 'express';
import { createServer } from 'http';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cluster from 'cluster';
import os from 'os';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

console.log('Imports loaded successfully');

// Import configurations and utilities
console.log('Loading config...');
import config from './config';
console.log('Config loaded successfully');
import { logger } from './utils/logger';
console.log('Logger loaded successfully');
console.log('Loading database config...');
import { db } from './config/database';
console.log('Database config loaded successfully');
console.log('Loading Redis utils...');
import { initializeRedis } from './utils/redis';
console.log('Redis utils imported successfully');
console.log('Loading email utils...');
import { initializeEmail } from './utils/email';
console.log('Email utils imported successfully');

// Import middleware
console.log('Loading middleware...');
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
console.log('Error handler middleware imported successfully');
// import { rateLimiter, generalRateLimiter } from './middleware/rateLimiter';
console.log('Rate limiter middleware import skipped for development');

// Import routes
console.log('Loading routes...');
import apiRoutes from './routes/basic';
console.log('Routes loaded successfully');
console.log('All imports completed successfully');

// Import Socket.IO setup
console.log('Loading Socket.IO setup...');
// Socket.IO setup
import { initializeSocket } from './socket';
console.log('Socket.IO setup loaded successfully');

console.log('Creating Express app...');
const app = express();
console.log('Creating HTTP server...');
const server = createServer(app);
console.log('HTTP server created successfully');

// Initialize Socket.IO
console.log('Initializing Socket.IO...');
const io = initializeSocket(server);
console.log('Socket.IO initialized successfully');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for rate limiting and IP detection
app.set('trust proxy', 1);

// Rate limiting (skip for development - requires Redis)
// app.use(generalRateLimiter);

// Request logging middleware
app.use((req: any, res: any, next: any) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  });
  
  next();
});

// Swagger documentation setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Chat API',
      version: '1.0.0',
      description: 'A comprehensive AI chat application API with real-time messaging, file uploads, and user management',
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'], // Path to the API files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// API routes
app.use('/api', apiRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

console.log('Express app configuration completed successfully');

// Initialize database and Redis connections
async function initializeServices(): Promise<boolean> {
  try {
    console.log('Initializing services...');
    
    // Database initialization
    await db.connect();
    console.log('Database connected successfully');
    
    // Redis initialization (optional for development)
    try {
      await initializeRedis();
      console.log('Redis connected successfully');
    } catch (error) {
      console.log('Redis connection failed, continuing without Redis for development:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Email service initialization (skip for development)
    console.log('Email service initialization skipped for development');
    // await initializeEmail();
    // console.log('Email service initialized successfully');
    
    console.log('All services initialized successfully (development mode)');
    return true;
  } catch (error) {
    console.error('Service initialization failed:', error);
    logger.error('Service initialization failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close Socket.IO
      io.close();
      logger.info('Socket.IO server closed');
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  });
  
  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Start server
async function startServer() {
  console.log('startServer function called');
  const PORT = config.server.port;
  console.log('Port:', PORT, 'Environment:', config.server.environment);
  
  if (cluster.isPrimary && config.server.environment === 'production') {
    console.log('Running in cluster mode (production)');
    const numCPUs = Math.min(os.cpus().length, 4); // Limit to 4 workers
    logger.info(`Master process ${process.pid} is running`);
    logger.info(`Starting ${numCPUs} workers`);
    
    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }
    
    cluster.on('exit', (worker: any, code: any, signal: any) => {
      logger.error(`Worker ${worker.process.pid} died with code ${code} and signal ${signal}`);
      logger.info('Starting a new worker');
      cluster.fork();
    });
    
    cluster.on('online', (worker: any) => {
      logger.info(`Worker ${worker.process.pid} is online`);
    });
  } else {
    console.log('Running in single process mode (development)');
    // Initialize services
    console.log('Initializing services...');
    const servicesInitialized = await initializeServices();
    console.log('Services initialized:', servicesInitialized);
    
    if (!servicesInitialized) {
      console.error('Failed to initialize services, exiting');
      logger.error('Failed to initialize services, exiting');
      process.exit(1);
    }
    
    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`🌍 Environment: ${config.server.environment}`);
      
      if (cluster.isWorker) {
        logger.info(`👷 Worker ${process.pid} started`);
      }
    });
    
    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else {
        logger.error('Server error', { error: error.message });
      }
      process.exit(1);
    });
  }
}

// Signal handlers for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    promise,
  });
  process.exit(1);
});

console.log('✅ Configuration loaded successfully');
console.log('🚀 Environment:', config.server.environment);
console.log('🔌 Port:', config.server.port);
console.log('🔗 CORS Origin:', config.cors.origin);

console.log('Starting server...');
console.log('About to call startServer() function');

// Start the server
startServer().then(() => {
  console.log('startServer() completed successfully');
}).catch((error) => {
  console.error('Failed to start server:', error);
  logger.error('Failed to start server', {
    error: error instanceof Error ? error.message : 'Unknown error',
  });
  process.exit(1);
});

export { app, server, io };