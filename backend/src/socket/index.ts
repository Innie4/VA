import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { config } from '../config/config';
import { authenticateSocket } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rateLimiter';
import chatHandlers from './chatHandlers';
import typingHandlers from './typingHandlers';
import presenceHandlers from './presenceHandlers';
import guestChatHandlers from './guestChatHandlers';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    tier: string;
    role: string;
  };
  isGuest?: boolean;
}

// Socket.IO rate limiter
const socketRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 events per minute per socket
  message: 'Too many socket events',
  standardHeaders: false,
  legacyHeaders: false,
});

export function initializeSocket(server: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // Middleware for optional authentication
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        // Allow anonymous/guest connections
        socket.isGuest = true;
        logger.info('Guest socket connection', {
          socketId: socket.id,
          ip: socket.handshake.address,
        });
        return next();
      }

      // Verify JWT token for authenticated users
      const decoded = jwt.verify(token, config.jwt.accessSecret) as any;
      
      // Get user from database
      const user = await db.getClient().user.findUnique({
        where: { 
          id: decoded.userId,
          isActive: true,
        },
        include: {
          role: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!user) {
        // If token is invalid, allow as guest instead of rejecting
        socket.isGuest = true;
        logger.warn('Invalid token provided, allowing as guest', {
          socketId: socket.id,
          ip: socket.handshake.address,
        });
        return next();
      }

      // Check if session is valid (skip Redis check in development if Redis is not available)
      try {
        const session = await redis.getSession(decoded.sessionId);
        if (!session) {
          // If session is invalid, allow as guest instead of rejecting
          socket.isGuest = true;
          logger.warn('Invalid session, allowing as guest', {
            socketId: socket.id,
            ip: socket.handshake.address,
          });
          return next();
        }
      } catch (error) {
        logger.warn('Redis session check failed, continuing without session validation', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue without Redis session validation in development
      }

      // Attach user to socket for authenticated connections
      socket.userId = user.id;
      socket.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tier: user.tier,
        role: user.role.name,
      };
      socket.isGuest = false;

      logger.info('Socket authenticated', {
        socketId: socket.id,
        userId: user.id,
        email: user.email,
        ip: socket.handshake.address,
      });

      next();
    } catch (error) {
      // If any error occurs during authentication, allow as guest
      socket.isGuest = true;
      logger.warn('Socket authentication failed, allowing as guest', {
        error: error instanceof Error ? error.message : 'Unknown error',
        socketId: socket.id,
        ip: socket.handshake.address,
      });
      next();
    }
  });

  // Connection handler
  io.on('connection', async (socket: AuthenticatedSocket) => {
    if (socket.isGuest) {
      // Handle guest connections
      logger.info('Guest connected via WebSocket', {
        socketId: socket.id,
        ip: socket.handshake.address,
      });

      // Join guest to a general guest room
      await socket.join('guests');
    } else {
      // Handle authenticated user connections
      const userId = socket.userId!;
      const user = socket.user!;

      logger.info('User connected via WebSocket', {
        socketId: socket.id,
        userId,
        email: user.email,
        ip: socket.handshake.address,
      });

      // Join user to their personal room
      await socket.join(`user:${userId}`);

      // Update user's online status
      try {
        await redis.setUserOnline(userId, socket.id);
      } catch (error) {
        logger.warn('Failed to set user online status in Redis', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
        });
      }

      // Update last active timestamp
      await db.getClient().user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });
    }

    // Register event handlers based on user type
    if (!socket.isGuest) {
      // Authenticated user handlers
      chatHandlers(io, socket as AuthenticatedSocket);
      typingHandlers(io, socket as AuthenticatedSocket);
      presenceHandlers(io, socket as AuthenticatedSocket);
    } else {
      // Guest user handlers
      guestChatHandlers(io, socket);
    }

    // Handle rate limiting for all events (skip if Redis is not available)
    socket.use(async (packet, next) => {
      try {
        // Apply rate limiting
        const rateLimitKey = socket.isGuest ? `socket_rate_limit:guest:${socket.id}` : `socket_rate_limit:${socket.userId}`;
        const current = await redis.incr(rateLimitKey);
        
        if (current === 1) {
          await redis.expire(rateLimitKey, 60); // 1 minute window
        }
        
        if (current > 100) { // 100 events per minute
          logger.warn('Socket rate limit exceeded', {
            userId: socket.userId || 'guest',
            socketId: socket.id,
            eventCount: current,
            isGuest: socket.isGuest,
          });
          return next(new Error('Rate limit exceeded'));
        }
        
        next();
      } catch (error) {
        logger.warn('Socket rate limiting failed, continuing without rate limiting', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: socket.userId || 'guest',
          socketId: socket.id,
          isGuest: socket.isGuest,
        });
        next(); // Continue without rate limiting if Redis is not available
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error', {
        error: error.message,
        socketId: socket.id,
        userId: socket.userId || 'guest',
        isGuest: socket.isGuest,
        ip: socket.handshake.address,
      });
    });

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      if (socket.isGuest) {
        logger.info('Guest disconnected from WebSocket', {
          socketId: socket.id,
          reason,
          ip: socket.handshake.address,
        });
      } else {
        const userId = socket.userId!;
        const user = socket.user!;
        
        logger.info('User disconnected from WebSocket', {
          socketId: socket.id,
          userId,
          email: user.email,
          reason,
          ip: socket.handshake.address,
        });

        try {
          // Remove user from online status
          try {
            await redis.setUserOffline(userId);
          } catch (redisError) {
            logger.warn('Failed to set user offline status in Redis', {
              error: redisError instanceof Error ? redisError.message : 'Unknown error',
              userId,
            });
          }

          // Leave all rooms
          socket.rooms.forEach(room => {
            if (room !== socket.id) {
              socket.leave(room);
            }
          });

          // Update last active timestamp
          await db.getClient().user.update({
            where: { id: userId },
            data: { lastActiveAt: new Date() },
          });
        } catch (error) {
          logger.error('Error handling socket disconnection', {
            error: error instanceof Error ? error.message : 'Unknown error',
            socketId: socket.id,
            userId,
          });
        }
      }

      // Leave all rooms for both guests and users
      socket.rooms.forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to chat server',
      userId: socket.userId || null,
      isGuest: socket.isGuest || false,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });
  });

  // Global error handler
  io.engine.on('connection_error', (err) => {
    logger.error('Socket.IO connection error', {
      error: err.message,
      code: err.code,
      context: err.context,
    });
  });

  // Log server events
  io.on('connect_error', (error) => {
    logger.error('Socket.IO connect error', {
      error: error.message,
    });
  });

  logger.info('Socket.IO server initialized', {
    cors: config.cors.origin,
    transports: ['websocket', 'polling'],
  });

  return io;
}

// Helper function to emit to user
export async function emitToUser(io: SocketIOServer, userId: string, event: string, data: any) {
  try {
    io.to(`user:${userId}`).emit(event, data);
    
    logger.debug('Event emitted to user', {
      userId,
      event,
      dataKeys: Object.keys(data),
    });
  } catch (error) {
    logger.error('Error emitting to user', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      event,
    });
  }
}

// Helper function to emit to conversation participants
export async function emitToConversation(io: SocketIOServer, conversationId: string, event: string, data: any, excludeUserId?: string) {
  try {
    // Get conversation participants
    const conversation = await db.getClient().conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });

    if (!conversation) {
      logger.warn('Conversation not found for emission', { conversationId });
      return;
    }

    // Emit to conversation participants (excluding specified user)
    if (conversation.userId !== excludeUserId) {
      io.to(`user:${conversation.userId}`).emit(event, data);
    }
    
    logger.debug('Event emitted to conversation', {
      conversationId,
      event,
      excludeUserId,
      dataKeys: Object.keys(data),
    });
  } catch (error) {
    logger.error('Error emitting to conversation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      conversationId,
      event,
    });
  }
}

// Helper function to broadcast to all connected users
export async function broadcastToAll(io: SocketIOServer, event: string, data: any) {
  try {
    io.emit(event, data);
    
    logger.debug('Event broadcasted to all users', {
      event,
      dataKeys: Object.keys(data),
    });
  } catch (error) {
    logger.error('Error broadcasting to all users', {
      error: error instanceof Error ? error.message : 'Unknown error',
      event,
    });
  }
}

export type { AuthenticatedSocket };