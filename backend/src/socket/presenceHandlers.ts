import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from './index';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';
import { db } from '../config/database';

interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: string;
  socketId?: string;
  deviceInfo?: string;
}

interface PresenceUpdateData {
  status: 'online' | 'away' | 'offline';
}

interface GetPresenceData {
  userIds: string[];
}

// Presence timeout in milliseconds (5 minutes)
const PRESENCE_TIMEOUT = 5 * 60 * 1000;

// Away timeout in milliseconds (2 minutes of inactivity)
const AWAY_TIMEOUT = 2 * 60 * 1000;

export default function presenceHandlers(io: SocketIOServer, socket: AuthenticatedSocket) {
  const userId = socket.userId!;
  const user = socket.user!;

  // Set user as online when they connect
  const setUserOnline = async () => {
    try {
      const presence: UserPresence = {
        userId,
        status: 'online',
        lastSeen: new Date().toISOString(),
        socketId: socket.id,
        deviceInfo: socket.handshake.headers['user-agent'] || 'Unknown',
      };

      // Store presence in Redis with expiration
      await redis.setJSON(`presence:${userId}`, presence, PRESENCE_TIMEOUT / 1000);
      
      // Add to online users set
      await redis.sadd('users:online', userId);
      await redis.expire('users:online', PRESENCE_TIMEOUT / 1000);

      // Store socket mapping
      await redis.setJSON(`socket:${socket.id}`, { userId }, PRESENCE_TIMEOUT / 1000);

      logger.debug('User presence set to online', {
        userId,
        socketId: socket.id,
        deviceInfo: presence.deviceInfo,
      });

      // Broadcast presence update to relevant users
      await broadcastPresenceUpdate(userId, presence);

    } catch (error) {
      logger.error('Error setting user online', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        socketId: socket.id,
      });
    }
  };

  // Set user as offline when they disconnect
  const setUserOffline = async () => {
    try {
      const presence: UserPresence = {
        userId,
        status: 'offline',
        lastSeen: new Date().toISOString(),
      };

      // Update presence in Redis
      await redis.setJSON(`presence:${userId}`, presence, PRESENCE_TIMEOUT / 1000);
      
      // Remove from online users set
      await redis.srem('users:online', userId);

      // Remove socket mapping
      await redis.del(`socket:${socket.id}`);

      logger.debug('User presence set to offline', {
        userId,
        socketId: socket.id,
      });

      // Broadcast presence update to relevant users
      await broadcastPresenceUpdate(userId, presence);

    } catch (error) {
      logger.error('Error setting user offline', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        socketId: socket.id,
      });
    }
  };

  // Broadcast presence update to users who should know about this user
  const broadcastPresenceUpdate = async (targetUserId: string, presence: UserPresence) => {
    try {
      // For now, we'll broadcast to all online users
      // In a more complex system, you might want to broadcast only to:
      // - Users in the same conversations
      // - Friends/contacts
      // - Users in the same organization
      
      socket.broadcast.emit('presence_update', {
        userId: targetUserId,
        presence,
        timestamp: Date.now(),
      });

    } catch (error) {
      logger.error('Error broadcasting presence update', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetUserId,
        presence,
      });
    }
  };

  // Initialize user as online
  setUserOnline();

  // Handle manual presence updates
  socket.on('update_presence', async (data: PresenceUpdateData) => {
    try {
      const { status } = data;

      if (!['online', 'away', 'offline'].includes(status)) {
        socket.emit('error', {
          message: 'Invalid presence status',
          code: 'INVALID_PRESENCE_STATUS',
        });
        return;
      }

      const presence: UserPresence = {
        userId,
        status,
        lastSeen: new Date().toISOString(),
        ...(status !== 'offline' && { socketId: socket.id }),
        ...(status !== 'offline' && { deviceInfo: socket.handshake.headers['user-agent'] || 'Unknown' }),
      };

      // Update presence in Redis
      await redis.setJSON(`presence:${userId}`, presence, PRESENCE_TIMEOUT / 1000);
      
      if (status === 'online') {
        await redis.sadd('users:online', userId);
      } else if (status === 'offline') {
        await redis.srem('users:online', userId);
      }

      // Update last active timestamp in database
      await db.getClient().user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });

      logger.info('User presence updated', {
        userId,
        status,
        socketId: socket.id,
      });

      // Confirm update to user
      socket.emit('presence_updated', {
        status,
        timestamp: Date.now(),
      });

      // Broadcast to other users
      await broadcastPresenceUpdate(userId, presence);

    } catch (error) {
      logger.error('Error updating presence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        data,
      });

      socket.emit('error', {
        message: 'Failed to update presence',
        code: 'UPDATE_PRESENCE_ERROR',
      });
    }
  });

  // Get presence for specific users
  socket.on('get_presence', async (data: GetPresenceData) => {
    try {
      const { userIds } = data;

      if (!Array.isArray(userIds) || userIds.length === 0) {
        socket.emit('error', {
          message: 'User IDs array is required',
          code: 'INVALID_USER_IDS',
        });
        return;
      }

      if (userIds.length > 100) {
        socket.emit('error', {
          message: 'Too many user IDs (max 100)',
          code: 'TOO_MANY_USER_IDS',
        });
        return;
      }

      const presences: Record<string, UserPresence> = {};

      for (const targetUserId of userIds) {
        const presence = await redis.getJSON<UserPresence>(`presence:${targetUserId}`);
        if (presence) {
          // Check if presence is still valid
          const lastSeenTime = new Date(presence.lastSeen).getTime();
          const now = Date.now();
          const timeDiff = now - lastSeenTime;

          if (timeDiff > PRESENCE_TIMEOUT) {
            // Presence expired, mark as offline
            presence.status = 'offline';
            await redis.setJSON(`presence:${targetUserId}`, presence, PRESENCE_TIMEOUT / 1000);
            await redis.srem('users:online', targetUserId);
          } else if (timeDiff > AWAY_TIMEOUT && presence.status === 'online') {
            // Mark as away if inactive for too long
            presence.status = 'away';
            await redis.setJSON(`presence:${targetUserId}`, presence, PRESENCE_TIMEOUT / 1000);
          }

          presences[targetUserId] = presence;
        } else {
          // No presence data, assume offline
          presences[targetUserId] = {
            userId: targetUserId,
            status: 'offline',
            lastSeen: new Date().toISOString(),
          };
        }
      }

      socket.emit('presence_data', {
        presences,
        timestamp: Date.now(),
      });

      logger.debug('Presence data sent', {
        userId,
        requestedUsers: userIds.length,
        foundPresences: Object.keys(presences).length,
      });

    } catch (error) {
      logger.error('Error getting presence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        data,
      });

      socket.emit('error', {
        message: 'Failed to get presence data',
        code: 'GET_PRESENCE_ERROR',
      });
    }
  });

  // Get online users count
  socket.on('get_online_count', async () => {
    try {
      const onlineUsers = await redis.smembers('users:online');
      const count = onlineUsers.length;

      socket.emit('online_count', {
        count,
        timestamp: Date.now(),
      });

      logger.debug('Online count sent', {
        userId,
        count,
      });

    } catch (error) {
      logger.error('Error getting online count', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });

      socket.emit('error', {
        message: 'Failed to get online count',
        code: 'GET_ONLINE_COUNT_ERROR',
      });
    }
  });

  // Handle activity ping to prevent going away
  socket.on('activity_ping', async () => {
    try {
      const currentPresence = await redis.getJSON<UserPresence>(`presence:${userId}`);
      
      if (currentPresence) {
        currentPresence.lastSeen = new Date().toISOString();
        
        // If user was away, bring them back online
        if (currentPresence.status === 'away') {
          currentPresence.status = 'online';
          await broadcastPresenceUpdate(userId, currentPresence);
        }
        
        await redis.setJSON(`presence:${userId}`, currentPresence, PRESENCE_TIMEOUT / 1000);
      }

      // Update database timestamp
      await db.getClient().user.update({
        where: { id: userId },
        data: { lastActiveAt: new Date() },
      });

      logger.debug('Activity ping received', {
        userId,
        socketId: socket.id,
      });

    } catch (error) {
      logger.error('Error handling activity ping', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    await setUserOffline();
  });

  // Periodic check for away status
  const awayCheckInterval = setInterval(async () => {
    try {
      const currentPresence = await redis.getJSON<UserPresence>(`presence:${userId}`);
      
      if (currentPresence && currentPresence.status === 'online') {
        const lastSeenTime = new Date(currentPresence.lastSeen).getTime();
        const now = Date.now();
        const timeDiff = now - lastSeenTime;

        if (timeDiff > AWAY_TIMEOUT) {
          currentPresence.status = 'away';
          currentPresence.lastSeen = new Date().toISOString();
          
          await redis.setJSON(`presence:${userId}`, currentPresence, PRESENCE_TIMEOUT / 1000);
          await broadcastPresenceUpdate(userId, currentPresence);

          logger.debug('User marked as away due to inactivity', {
            userId,
            inactiveTime: timeDiff,
          });
        }
      }
    } catch (error) {
      logger.error('Error in away check interval', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
    }
  }, 30000); // Check every 30 seconds

  // Clear interval on disconnect
  socket.on('disconnect', () => {
    clearInterval(awayCheckInterval);
  });
}

// Helper function to clean up expired presence data
export async function cleanupExpiredPresence() {
  try {
    const pattern = 'presence:*';
    const keys = await redis.keys(pattern);
    let cleanedCount = 0;

    for (const key of keys) {
      const presence = await redis.getJSON<UserPresence>(key);
      if (presence && presence.lastSeen) {
        const lastSeenTime = new Date(presence.lastSeen).getTime();
        const now = Date.now();
        const timeDiff = now - lastSeenTime;

        if (timeDiff > PRESENCE_TIMEOUT) {
          // Mark as offline and update
          presence.status = 'offline';
          presence.lastSeen = new Date().toISOString();
          
          await redis.setJSON(key, presence, PRESENCE_TIMEOUT / 1000);
          
          // Remove from online users set
          const userId = key.replace('presence:', '');
          await redis.srem('users:online', userId);
          
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up expired presence data', {
        cleanedCount,
        totalKeys: keys.length,
      });
    }

  } catch (error) {
    logger.error('Error cleaning up expired presence data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Schedule periodic cleanup (run every 2 minutes)
setInterval(cleanupExpiredPresence, 2 * 60 * 1000);