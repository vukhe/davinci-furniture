/**
 * Lightweight in-memory cache – không cần Redis
 * Dùng cho product list, categories (dữ liệu ít thay đổi)
 * Tự động clear khi có write operation
 */

const store  = new Map();
const timers = new Map();

const cache = {
  get(key) {
    return store.get(key) ?? null;
  },

  set(key, value, ttlSeconds = 300) {
    // Clear existing timer
    if (timers.has(key)) clearTimeout(timers.get(key));

    store.set(key, value);
    const t = setTimeout(() => {
      store.delete(key);
      timers.delete(key);
    }, ttlSeconds * 1000);
    timers.set(key, t);
  },

  del(key) {
    store.delete(key);
    if (timers.has(key)) { clearTimeout(timers.get(key)); timers.delete(key); }
  },

  // Xóa tất cả key bắt đầu bằng prefix
  delByPrefix(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) this.del(key);
    }
  },

  flush() {
    store.clear();
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
  },

  size() { return store.size; },
};

/**
 * Express middleware – cache GET responses
 * Usage: router.get('/products', cacheMiddleware(60), controller)
 */
const cacheMiddleware = (ttl = 300) => (req, res, next) => {
  if (req.method !== 'GET') return next();

  const key = `http:${req.originalUrl}`;
  const cached = cache.get(key);

  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Intercept res.json to store in cache
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) {
      cache.set(key, body, ttl);
    }
    res.setHeader('X-Cache', 'MISS');
    return originalJson(body);
  };

  next();
};

module.exports = { cache, cacheMiddleware };
