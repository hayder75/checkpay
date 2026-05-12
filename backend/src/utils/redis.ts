import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let isConnecting = false;

/**
 * Get or create Redis client
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  // If we're still connecting and it's been too long, return mock client
  if (isConnecting) {
    // Wait max 500ms for connection
    const maxWait = Date.now() + 500;
    while (!redisClient || !redisClient.isOpen) {
      if (Date.now() > maxWait) {
        console.log('[Redis] Connection timeout, using mock client');
        return createMockRedisClient();
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return redisClient;
  }

  // Check if Redis is disabled or unavailable (quick check)
  // Don't try to connect if we've failed before
  if (process.env.REDIS_DISABLED === 'true') {
    return createMockRedisClient();
  }

  isConnecting = true;

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 1000, // 1 second timeout
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            // After 3 retries, give up and use mock client silently
            return false; // Stop reconnecting
          }
          return Math.min(retries * 100, 500);
        },
      },
    });

    redisClient.on('error', (err) => {
      // Silently fail - don't log errors in production
      // System will use mock client gracefully
    });

    // Redis connection success - no logging needed in production

    // Try to connect with timeout
    await Promise.race([
      redisClient.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 1000)
      )
    ]);
    
    isConnecting = false;
    return redisClient;
  } catch (error) {
    isConnecting = false;
    // Silently use mock client - system will work normally
    const mockClient = createMockRedisClient() as RedisClientType;
    redisClient = mockClient;
    return mockClient;
  }
}

/**
 * Mock Redis client for graceful degradation when Redis is unavailable
 * Returns immediately with null/OK values - no actual operations
 */
function createMockRedisClient(): RedisClientType {
  return {
    isOpen: false,
    get: async () => Promise.resolve(null),
    set: async () => Promise.resolve('OK'),
    setEx: async () => Promise.resolve('OK'),
    del: async () => Promise.resolve(0),
    exists: async () => Promise.resolve(0),
    expire: async () => Promise.resolve(false),
    lPush: async () => Promise.resolve(0),
    lTrim: async () => Promise.resolve('OK'),
    keys: async () => Promise.resolve([]),
    flushAll: async () => Promise.resolve('OK'),
    quit: async () => Promise.resolve('OK'),
    disconnect: async () => Promise.resolve(),
  } as any;
}

/**
 * Cache helper functions
 */
export const cache = {
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient();
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      // Silently fail - graceful degradation
      return null;
    }
  },

  /**
   * Set value in cache with TTL (time to live in seconds)
   */
  async set(key: string, value: any, ttlSeconds: number = 600): Promise<void> {
    try {
      const client = await getRedisClient();
      await client.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      // Silently fail - graceful degradation
    }
  },

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<void> {
    try {
      const client = await getRedisClient();
      await client.del(key);
    } catch (error) {
      // Silently fail
    }
  },

  /**
   * Delete multiple keys matching pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const client = await getRedisClient();
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      console.error(`Redis DEL pattern error for ${pattern}:`, error);
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      const result = await client.exists(key);
      return result > 0;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  },
};

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
    redisClient = null;
  }
}

export default cache;

