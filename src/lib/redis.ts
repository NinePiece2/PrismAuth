import Redis from "ioredis";

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  // Redis is optional - return null if not configured
  return null;
};

let redis: Redis | null = null;

const url = getRedisUrl();
if (url) {
  redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });

  redis.on("error", (error) => {
    console.error("Redis connection error:", error);
  });

  redis.on("connect", () => {
    console.log("✓ Redis connected");
  });
}

export { redis };

// Helper functions for caching
export const cacheGet = async (key: string): Promise<string | null> => {
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch (error) {
    console.error("Redis GET error:", error);
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: string,
  expirySeconds?: number,
): Promise<void> => {
  if (!redis) return;
  try {
    if (expirySeconds) {
      await redis.setex(key, expirySeconds, value);
    } else {
      await redis.set(key, value);
    }
  } catch (error) {
    console.error("Redis SET error:", error);
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (error) {
    console.error("Redis DEL error:", error);
  }
};
