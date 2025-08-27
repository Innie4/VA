import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

// Redis client instance
let redisClient: Redis | null = null;

/**
 * Initialize Redis connection
 */
export const initializeRedis = async (): Promise<Redis | null> => {
  try {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      family: 4, // IPv4
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      enableOfflineQueue: config.redis.enableOfflineQueue,
    });

    // Event listeners
    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis client error:', error);
    });

    redisClient.on('close', () => {
      logger.warn('Redis client connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });

    redisClient.on('end', () => {
      logger.warn('Redis client connection ended');
    });

    // Connect to Redis
    await redisClient.connect();
    
    // Test connection
    await redisClient.ping();
    logger.info('Redis connection established successfully');

    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis (continuing without Redis for development):', error);
    return null;
  }
};

/**
 * Get Redis client instance
 */
export const getRedisClient = (): Redis | null => {
  return redisClient || null;
};

/**
 * Check if Redis is available
 */
export const isRedisAvailable = (): boolean => {
  return redisClient !== null && redisClient !== undefined;
};

/**
 * Close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
      redisClient.disconnect();
    }
  }
};

/**
 * Redis utility functions
 */
export class RedisService {
  private client: Redis;

  constructor(client?: Redis) {
    const redisClient = getRedisClient();
    if (!client && !redisClient) {
      throw new Error('Redis client not initialized');
    }
    this.client = client || redisClient!;
  }

  /**
   * Set a key-value pair with optional expiration
   */
  async set(key: string, value: string | number | Buffer, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error(`Redis SET error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error(`Redis GET error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error(`Redis DEL error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXISTS error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      logger.error(`Redis EXPIRE error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get time to live for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error(`Redis TTL error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error(`Redis INCR error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Increment by a specific amount
   */
  async incrby(key: string, increment: number): Promise<number> {
    try {
      return await this.client.incrby(key, increment);
    } catch (error) {
      logger.error(`Redis INCRBY error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Decrement a numeric value
   */
  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      logger.error(`Redis DECR error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Add to a set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      logger.error(`Redis SADD error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Remove from a set
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.srem(key, ...members);
    } catch (error) {
      logger.error(`Redis SREM error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if member exists in set
   */
  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const result = await this.client.sismember(key, member);
      return result === 1;
    } catch (error) {
      logger.error(`Redis SISMEMBER error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      logger.error(`Redis SMEMBERS error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Add to a hash
   */
  async hset(key: string, field: string, value: string | number): Promise<number> {
    try {
      return await this.client.hset(key, field, value);
    } catch (error) {
      logger.error(`Redis HSET error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get from a hash
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      logger.error(`Redis HGET error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all fields and values from a hash
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      logger.error(`Redis HGETALL error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete field from hash
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      return await this.client.hdel(key, ...fields);
    } catch (error) {
      logger.error(`Redis HDEL error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Push to list (left)
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.lpush(key, ...values);
    } catch (error) {
      logger.error(`Redis LPUSH error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Push to list (right)
   */
  async rpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.rpush(key, ...values);
    } catch (error) {
      logger.error(`Redis RPUSH error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Pop from list (left)
   */
  async lpop(key: string): Promise<string | null> {
    try {
      return await this.client.lpop(key);
    } catch (error) {
      logger.error(`Redis LPOP error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Pop from list (right)
   */
  async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rpop(key);
    } catch (error) {
      logger.error(`Redis RPOP error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get list range
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.lrange(key, start, stop);
    } catch (error) {
      logger.error(`Redis LRANGE error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get list length
   */
  async llen(key: string): Promise<number> {
    try {
      return await this.client.llen(key);
    } catch (error) {
      logger.error(`Redis LLEN error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Execute multiple commands in a pipeline
   */
  async pipeline(commands: Array<[string, ...any[]]>): Promise<any[]> {
    try {
      const pipeline = this.client.pipeline();
      commands.forEach(([command, ...args]) => {
        (pipeline as any)[command](...args);
      });
      const results = await pipeline.exec();
      return results?.map(([error, result]) => {
        if (error) throw error;
        return result;
      }) || [];
    } catch (error) {
      logger.error('Redis PIPELINE error:', error);
      throw error;
    }
  }

  /**
   * Execute commands in a transaction
   */
  async multi(commands: Array<[string, ...any[]]>): Promise<any[]> {
    try {
      const multi = this.client.multi();
      commands.forEach(([command, ...args]) => {
        (multi as any)[command](...args);
      });
      const results = await multi.exec();
      return results?.map(([error, result]) => {
        if (error) throw error;
        return result;
      }) || [];
    } catch (error) {
      logger.error('Redis MULTI error:', error);
      throw error;
    }
  }

  /**
   * Flush all data from current database
   */
  async flushdb(): Promise<void> {
    try {
      await this.client.flushdb();
      logger.info('Redis database flushed');
    } catch (error) {
      logger.error('Redis FLUSHDB error:', error);
      throw error;
    }
  }

  /**
   * Get Redis info
   */
  async info(section?: string): Promise<string> {
    try {
      return await this.client.info(section || 'default');
    } catch (error) {
      logger.error('Redis INFO error:', error);
      throw error;
    }
  }

  /**
   * Ping Redis server
   */
  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      logger.error('Redis PING error:', error);
      throw error;
    }
  }
}

// Export singleton instance (lazy-loaded)
let redisServiceInstance: RedisService | null = null;

export const getRedisService = (): RedisService | null => {
  if (!redisServiceInstance && redisClient) {
    redisServiceInstance = new RedisService();
  }
  return redisServiceInstance;
};

// For backward compatibility
export const redisService = {
  get instance() {
    return getRedisService();
  }
};

// Export the client directly for backward compatibility
export { redisClient };

// Default export
export default {
  initializeRedis,
  getRedisClient,
  getRedisService,
  closeRedis,
  get redisClient() { return redisClient; },
};