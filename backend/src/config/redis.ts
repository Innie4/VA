import Redis, { RedisOptions } from 'ioredis';
import { logger } from '../utils/logger';

// Redis client singleton
class RedisManager {
  private static instance: RedisManager;
  private client: Redis;
  private subscriber: Redis;
  private publisher: Redis;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 5000; // 5 seconds

  private constructor() {
    const redisConfig: RedisOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
      db: parseInt(process.env.REDIS_DB || '0'),

      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,

      enableOfflineQueue: false,
    };

    // Main Redis client
    this.client = new Redis(redisConfig);
    
    // Separate clients for pub/sub to avoid blocking
    this.subscriber = new Redis(redisConfig);
    this.publisher = new Redis(redisConfig);

    this.setupEventListeners();
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  private setupEventListeners(): void {
    // Main client events
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.connectionRetries = 0;
      logger.info('Redis client ready', {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
        db: process.env.REDIS_DB || '0',
      });
    });

    this.client.on('error', (error: Error) => {
      this.isConnected = false;
      logger.error('Redis client error', {
        error: error.message,
        code: (error as any).code,
      });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', (delay: number) => {
      this.connectionRetries++;
      logger.info('Redis client reconnecting', {
        delay,
        retries: this.connectionRetries,
      });
    });

    this.client.on('end', () => {
      this.isConnected = false;
      logger.info('Redis client connection ended');
    });

    // Subscriber events
    this.subscriber.on('error', (error: Error) => {
      logger.error('Redis subscriber error', {
        error: error.message,
      });
    });

    // Publisher events
    this.publisher.on('error', (error: Error) => {
      logger.error('Redis publisher error', {
        error: error.message,
      });
    });
  }

  public async connect(): Promise<void> {
    try {
      await Promise.all([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect(),
      ]);
      
      // Test the connection
      await this.healthCheck();
      
      logger.info('All Redis clients connected successfully');
    } catch (error) {
      logger.error('Redis connection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        retries: this.connectionRetries,
      });
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await Promise.all([
        this.client.disconnect(),
        this.subscriber.disconnect(),
        this.publisher.disconnect(),
      ]);
      
      this.isConnected = false;
      logger.info('All Redis clients disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting Redis clients', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  public getClient(): Redis {
    return this.client;
  }

  public getSubscriber(): Redis {
    return this.subscriber;
  }

  public getPublisher(): Redis {
    return this.publisher;
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  // Cache operations
  public async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  public async set(
    key: string,
    value: string,
    ttl?: number
  ): Promise<boolean> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error', {
        key,
        ttl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  public async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  public async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXPIRE error', {
        key,
        ttl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  public async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Redis TTL error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return -1;
    }
  }

  // JSON operations
  public async getJSON<T>(key: string): Promise<T | null> {
    try {
      const value = await this.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis JSON GET error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  public async setJSON(
    key: string,
    value: any,
    ttl?: number
  ): Promise<boolean> {
    try {
      const jsonValue = JSON.stringify(value);
      return await this.set(key, jsonValue, ttl);
    } catch (error) {
      logger.error('Redis JSON SET error', {
        key,
        ttl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  // Hash operations
  public async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      logger.error('Redis HGET error', {
        key,
        field,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  public async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      await this.client.hset(key, field, value);
      return true;
    } catch (error) {
      logger.error('Redis HSET error', {
        key,
        field,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  public async hgetall(key: string): Promise<Record<string, string> | null> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      logger.error('Redis HGETALL error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  // List operations
  public async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.lpush(key, ...values);
    } catch (error) {
      logger.error('Redis LPUSH error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  public async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rpop(key);
    } catch (error) {
      logger.error('Redis RPOP error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  // Set operations
  public async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      logger.error('Redis SADD error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  public async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.srem(key, ...members);
    } catch (error) {
      logger.error('Redis SREM error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  public async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      logger.error('Redis SMEMBERS error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  // Pub/Sub operations
  public async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.publisher.publish(channel, message);
    } catch (error) {
      logger.error('Redis PUBLISH error', {
        channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  public async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (receivedChannel: string, message: string) => {
        if (receivedChannel === channel) {
          callback(message);
        }
      });
    } catch (error) {
      logger.error('Redis SUBSCRIBE error', {
        channel,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Rate limiting helper
  public async rateLimit(
    key: string,
    limit: number,
    window: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const current = await this.client.incr(key);
      
      if (current === 1) {
        await this.client.expire(key, window);
      }
      
      const ttl = await this.client.ttl(key);
      const resetTime = Date.now() + (ttl * 1000);
      
      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime,
      };
    } catch (error) {
      logger.error('Redis rate limit error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Fail open - allow the request if Redis is down
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + (window * 1000),
      };
    }
  }

  // Session management
  public async createSession(sessionId: string, data: any, ttl: number = 3600): Promise<boolean> {
    return await this.setJSON(`session:${sessionId}`, data, ttl);
  }

  public async getSession<T>(sessionId: string): Promise<T | null> {
    return await this.getJSON<T>(`session:${sessionId}`);
  }

  public async destroySession(sessionId: string): Promise<boolean> {
    return await this.del(`session:${sessionId}`);
  }

  // User presence and activity helpers
  public async setUserOnline(userId: string, socketId: string): Promise<void> {
    await this.setJSON(`user:online:${userId}`, { socketId, timestamp: Date.now() }, 300);
    await this.sadd('users:online', userId);
  }

  public async setUserOffline(userId: string): Promise<void> {
    await this.del(`user:online:${userId}`);
    await this.srem('users:online', userId);
  }

  public async setUserActiveConversation(userId: string, conversationId: string): Promise<void> {
    await this.set(`user:active:${userId}`, conversationId, 3600);
  }

  public async clearUserActiveConversation(userId: string): Promise<void> {
    await this.del(`user:active:${userId}`);
  }

  public async checkUserConversationAccess(userId: string, conversationId: string): Promise<boolean> {
    const activeConversation = await this.get(`user:active:${userId}`);
    return activeConversation === conversationId;
  }

  // Additional Redis commands
  public async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS error', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  public async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error('Redis INCR error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  public async setex(key: string, seconds: number, value: string): Promise<boolean> {
    try {
      await this.client.setex(key, seconds, value);
      return true;
    } catch (error) {
      logger.error('Redis SETEX error', {
        key,
        seconds,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  // Cache statistics
  public async getStats(): Promise<any> {
    try {
      const info = await this.client.info();
      return {
        connected: this.isConnected,
        info: info,
        connectionRetries: this.connectionRetries,
      };
    } catch (error) {
      logger.error('Failed to get Redis stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }
}

// Export singleton instance
const redis = RedisManager.getInstance();
const redisClient = redis.getClient();
const redisSubscriber = redis.getSubscriber();
const redisPublisher = redis.getPublisher();

// Cleanup function for graceful shutdown
const redisCleanup = async (): Promise<void> => {
  try {
    await redis.disconnect();
    logger.info('Redis cleanup completed');
  } catch (error) {
    logger.error('Redis cleanup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export {
  redis,
  redisClient,
  redisSubscriber,
  redisPublisher,
  RedisManager,
  redisCleanup as cleanup,
  redis as default
};