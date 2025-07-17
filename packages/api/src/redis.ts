import Redis from 'ioredis';

/**
 * Redis client configuration and utilities
 */
class RedisService {
  private client: Redis;
  private connected: boolean = false;

  constructor() {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };
    
    this.client = new Redis(redisConfig);

    this.client.on('connect', () => {
      console.log('✅ Redis connected successfully');
      this.connected = true;
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
      this.connected = false;
    });

    this.client.on('close', () => {
      console.log('🔌 Redis connection closed');
      this.connected = false;
    });
  }

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<boolean> {
    try {
      await this.client.connect();
      return true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      return false;
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) return null;
    
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached data with TTL
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<boolean> {
    if (!this.connected) return false;
    
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Redis set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached data
   */
  async delete(key: string): Promise<boolean> {
    if (!this.connected) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`Redis delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Cache with automatic key generation and TTL
   */
  async cache<T>(
    key: string, 
    fetchFunction: () => Promise<T>, 
    ttlSeconds: number = 300
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      console.log(`📦 Cache hit for key: ${key}`);
      return cached;
    }

    // Fetch fresh data
    console.log(`🔄 Cache miss for key: ${key}, fetching fresh data`);
    const freshData = await fetchFunction();
    
    // Store in cache for next time
    await this.set(key, freshData, ttlSeconds);
    
    return freshData;
  }

  /**
   * Invalidate cache patterns
   */
  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.connected) return 0;
    
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        const deleted = await this.client.del(...keys);
        console.log(`🗑️ Invalidated ${deleted} cache keys matching pattern: ${pattern}`);
        return deleted;
      }
      return 0;
    } catch (error) {
      console.error(`Redis invalidate pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    if (!this.connected) return null;
    
    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      return { memory: info, keyspace };
    } catch (error) {
      console.error('Redis stats error:', error);
      return null;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
    }
  }
}

// Export singleton instance
export const redis = new RedisService();

// Export cache key generators
export const CacheKeys = {
  stories: {
    trending: (timeframe: string, limit: number) => `stories:trending:${timeframe}:${limit}`,
    search: (query: string, timeframe: string, coverage: string, limit: number) => 
      `stories:search:${Buffer.from(query).toString('base64')}:${timeframe}:${coverage}:${limit}`,
    details: (id: number) => `stories:details:${id}`,
  },
  articles: {
    list: (bias?: number, limit?: number) => `articles:list:${bias || 'all'}:${limit || 10}`,
    elasticsearch: (query: string, size: number) => 
      `articles:es:${Buffer.from(query).toString('base64')}:${size}`,
  },
  sources: {
    all: () => 'sources:all',
    bias: (bias: string) => `sources:bias:${bias}`,
  },
  analytics: {
    overview: () => 'analytics:overview',
    biasDistribution: () => 'analytics:bias_distribution',
  }
};

// Cache TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 60,        // 1 minute - for frequently changing data
  MEDIUM: 300,      // 5 minutes - for moderately changing data
  LONG: 1800,       // 30 minutes - for slowly changing data
  VERY_LONG: 3600,  // 1 hour - for rarely changing data
};
