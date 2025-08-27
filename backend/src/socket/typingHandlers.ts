import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from './index';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

interface TypingData {
  conversationId: string;
  isTyping: boolean;
}

interface TypingUser {
  userId: string;
  firstName: string;
  lastName: string;
  timestamp: number;
}

// Typing timeout in milliseconds (5 seconds)
const TYPING_TIMEOUT = 5000;

export default function typingHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  const userId = socket.userId!;
  const user = socket.user!;

  // Handle typing start/stop
  socket.on('typing', async (data: TypingData) => {
    try {
      const { conversationId, isTyping } = data;

      if (!conversationId) {
        socket.emit('error', {
          message: 'Conversation ID is required',
          code: 'INVALID_TYPING_DATA',
        });
        return;
      }

      // Verify user has access to this conversation
      const hasAccess = await redis.checkUserConversationAccess(userId, conversationId);
      if (!hasAccess) {
        // Check database as fallback
        const { db } = await import('../config/database');
        const conversation = await db.getClient().conversation.findFirst({
          where: {
            id: conversationId,
            userId: userId,
          },
        });

        if (!conversation) {
          socket.emit('error', {
            message: 'Conversation not found or access denied',
            code: 'CONVERSATION_NOT_FOUND',
          });
          return;
        }
      }

      const typingKey = `typing:${conversationId}`;
      const userTypingKey = `typing:${conversationId}:${userId}`;

      if (isTyping) {
        // User started typing
        const typingUser: TypingUser = {
          userId,
          firstName: user.firstName,
          lastName: user.lastName,
          timestamp: Date.now(),
        };

        // Store typing status in Redis with expiration
        await redis.setJSON(userTypingKey, typingUser, TYPING_TIMEOUT / 1000);
        
        // Add user to typing set
        await redis.sadd(typingKey, userId);
        await redis.expire(typingKey, TYPING_TIMEOUT / 1000);

        logger.debug('User started typing', {
          userId,
          conversationId,
          socketId: socket.id,
        });
      } else {
        // User stopped typing
        await redis.del(userTypingKey);
        await redis.srem(typingKey, userId);

        logger.debug('User stopped typing', {
          userId,
          conversationId,
          socketId: socket.id,
        });
      }

      // Get current typing users
      const typingUserIds = await redis.smembers(typingKey);
      const typingUsers: TypingUser[] = [];

      // Get details for each typing user
      for (const typingUserId of typingUserIds) {
        const userTypingData = await redis.getJSON<TypingUser>(`typing:${conversationId}:${typingUserId}`);
        if (userTypingData) {
          // Check if typing status is still valid (not expired)
          const timeDiff = Date.now() - userTypingData.timestamp;
          if (timeDiff < TYPING_TIMEOUT) {
            typingUsers.push(userTypingData);
          } else {
            // Remove expired typing status
            await redis.del(`typing:${conversationId}:${typingUserId}`);
            await redis.srem(typingKey, typingUserId);
          }
        }
      }

      // Emit typing status to all conversation participants except the sender
      socket.to(`conversation:${conversationId}`).emit('typing_update', {
        conversationId,
        typingUsers: typingUsers.filter(tu => tu.userId !== userId),
        timestamp: Date.now(),
      });

      // Also emit to sender for confirmation
      socket.emit('typing_confirmed', {
        conversationId,
        isTyping,
        timestamp: Date.now(),
      });

    } catch (error) {
      logger.error('Error handling typing event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        data,
        socketId: socket.id,
      });

      socket.emit('error', {
        message: 'Failed to update typing status',
        code: 'TYPING_ERROR',
      });
    }
  });

  // Handle typing timeout cleanup
  socket.on('typing_timeout', async (data: { conversationId: string }) => {
    try {
      const { conversationId } = data;

      if (!conversationId) {
        return;
      }

      const userTypingKey = `typing:${conversationId}:${userId}`;
      const typingKey = `typing:${conversationId}`;

      // Remove user from typing status
      await redis.del(userTypingKey);
      await redis.srem(typingKey, userId);

      // Get remaining typing users
      const typingUserIds = await redis.smembers(typingKey);
      const typingUsers: TypingUser[] = [];

      for (const typingUserId of typingUserIds) {
        const userTypingData = await redis.getJSON<TypingUser>(`typing:${conversationId}:${typingUserId}`);
        if (userTypingData) {
          const timeDiff = Date.now() - userTypingData.timestamp;
          if (timeDiff < TYPING_TIMEOUT) {
            typingUsers.push(userTypingData);
          } else {
            await redis.del(`typing:${conversationId}:${typingUserId}`);
            await redis.srem(typingKey, typingUserId);
          }
        }
      }

      // Emit updated typing status
      socket.to(`conversation:${conversationId}`).emit('typing_update', {
        conversationId,
        typingUsers,
        timestamp: Date.now(),
      });

      logger.debug('Typing timeout handled', {
        userId,
        conversationId,
        remainingTypingUsers: typingUsers.length,
      });

    } catch (error) {
      logger.error('Error handling typing timeout', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        data,
      });
    }
  });

  // Get current typing users for a conversation
  socket.on('get_typing_users', async (data: { conversationId: string }) => {
    try {
      const { conversationId } = data;

      if (!conversationId) {
        socket.emit('error', {
          message: 'Conversation ID is required',
          code: 'INVALID_REQUEST',
        });
        return;
      }

      const typingKey = `typing:${conversationId}`;
      const typingUserIds = await redis.smembers(typingKey);
      const typingUsers: TypingUser[] = [];

      for (const typingUserId of typingUserIds) {
        if (typingUserId !== userId) { // Exclude current user
          const userTypingData = await redis.getJSON<TypingUser>(`typing:${conversationId}:${typingUserId}`);
          if (userTypingData) {
            const timeDiff = Date.now() - userTypingData.timestamp;
            if (timeDiff < TYPING_TIMEOUT) {
              typingUsers.push(userTypingData);
            } else {
              // Clean up expired typing status
              await redis.del(`typing:${conversationId}:${typingUserId}`);
              await redis.srem(typingKey, typingUserId);
            }
          }
        }
      }

      socket.emit('typing_users', {
        conversationId,
        typingUsers,
        timestamp: Date.now(),
      });

    } catch (error) {
      logger.error('Error getting typing users', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        data,
      });

      socket.emit('error', {
        message: 'Failed to get typing users',
        code: 'GET_TYPING_USERS_ERROR',
      });
    }
  });

  // Clean up typing status when user disconnects
  socket.on('disconnect', async () => {
    try {
      // Get all conversations where user might be typing
      const pattern = `typing:*:${userId}`;
      const keys = await redis.keys(pattern);

      for (const key of keys) {
        // Extract conversation ID from key
        const parts = key.split(':');
        if (parts.length === 3) {
          const conversationId = parts[1];
          const typingKey = `typing:${conversationId}`;

          // Remove user from typing status
          await redis.del(key);
          await redis.srem(typingKey, userId);

          // Get remaining typing users
          const typingUserIds = await redis.smembers(typingKey);
          const typingUsers: TypingUser[] = [];

          for (const typingUserId of typingUserIds) {
            const userTypingData = await redis.getJSON<TypingUser>(`typing:${conversationId}:${typingUserId}`);
            if (userTypingData) {
              const timeDiff = Date.now() - userTypingData.timestamp;
              if (timeDiff < TYPING_TIMEOUT) {
                typingUsers.push(userTypingData);
              }
            }
          }

          // Emit updated typing status to conversation
          socket.to(`conversation:${conversationId}`).emit('typing_update', {
            conversationId,
            typingUsers,
            timestamp: Date.now(),
          });
        }
      }

      logger.debug('Cleaned up typing status on disconnect', {
        userId,
        cleanedKeys: keys.length,
      });

    } catch (error) {
      logger.error('Error cleaning up typing status on disconnect', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
    }
  });
}

// Helper function to clean up expired typing statuses
export async function cleanupExpiredTyping() {
  try {
    const { redis } = await import('../config/redis');
    const { logger } = await import('../utils/logger');
    
    const pattern = 'typing:*:*';
    const keys = await redis.keys(pattern);
    let cleanedCount = 0;

    for (const key of keys) {
      const data = await redis.getJSON<TypingUser>(key);
      if (data && data.timestamp) {
        const timeDiff = Date.now() - data.timestamp;
        if (timeDiff >= TYPING_TIMEOUT) {
          // Extract conversation ID and user ID from key
          const parts = key.split(':');
          if (parts.length === 3) {
            const conversationId = parts[1];
            const userId = parts[2];
            const typingKey = `typing:${conversationId}`;

            if (userId) {
              await redis.del(key);
              await redis.srem(typingKey, userId);
              cleanedCount++;
            }
          }
        }
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up expired typing statuses', {
        cleanedCount,
        totalKeys: keys.length,
      });
    }

  } catch (error) {
    const { logger } = await import('../utils/logger');
    logger.error('Error cleaning up expired typing statuses', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Schedule periodic cleanup (run every 30 seconds)
setInterval(cleanupExpiredTyping, 30000);