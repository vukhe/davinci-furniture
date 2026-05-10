/**
 * Redis Cache Layer
 * Fallback gracefully nếu Redis chưa cài → dùng in-memory cache
 */
const { cache: memCache } = require('../middleware/cache');

let redisClient = null;
let useRedis = false;

const initRedis = async () => {
  try {
    const redis = require('redis');
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: { connectTimeout: 3000, reconnectStrategy: (n) => n > 3 ? false : 1000 * n },
    });
    redisClient.on('error', () => {});
    await redisClient.connect();
    useRedis = true;
    console.log('✅ Redis connected');
  } catch {
    console.log('⚡ Redis not available – using in-memory cache');
  }
};

const TTL = {
  products:    60,    // sản phẩm – 60s
  productSlug: 120,   // chi tiết sản phẩm – 2 phút
  categories:  300,   // danh mục – 5 phút (ít thay đổi)
  collections: 300,   // bộ sưu tập – 5 phút
  blog:        120,   // bài viết – 2 phút
  blogSlug:    300,   // chi tiết bài – 5 phút
  dashboard:   30,    // dashboard admin – 30s
};

const get = async (key) => {
  if (useRedis) {
    const val = await redisClient.get(key).catch(() => null);
    return val ? JSON.parse(val) : null;
  }
  return memCache.get(key);
};

const set = async (key, value, ttlSeconds = 60) => {
  if (useRedis) {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value)).catch(() => {});
  } else {
    memCache.set(key, value, ttlSeconds);
  }
};

const del = async (key) => {
  if (useRedis) await redisClient.del(key).catch(() => {});
  else memCache.del(key);
};

const delPattern = async (pattern) => {
  if (useRedis) {
    const keys = await redisClient.keys(pattern).catch(() => []);
    if (keys.length) await redisClient.del(keys).catch(() => {});
  } else {
    const prefix = pattern.replace('*', '');
    memCache.delByPrefix(prefix);
  }
};

// Express middleware
const cacheMiddleware = (ttlSeconds = 60, keyPrefix = '') => async (req, res, next) => {
  if (req.method !== 'GET') return next();
  const key = `cache:${keyPrefix}${req.originalUrl}`;
  const cached = await get(key);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    if (res.statusCode === 200) await set(key, body, ttlSeconds);
    res.setHeader('X-Cache', 'MISS');
    return originalJson(body);
  };
  next();
};

module.exports = { initRedis, get, set, del, delPattern, cacheMiddleware, TTL };
