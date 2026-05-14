const express = require('express');
const router  = express.Router();

const authCtrl       = require('../controllers/authController');
const productCtrl    = require('../controllers/productController');
const orderCtrl      = require('../controllers/orderController');
const adminCtrl      = require('../controllers/adminController');
const categoryCtrl   = require('../controllers/categoryController');
const collCtrl       = require('../controllers/collectionController');
const cartCtrl       = require('../controllers/cartController');
const wishlistCtrl   = require('../controllers/wishlistController');
const reviewCtrl     = require('../controllers/reviewController');
const blogCtrl       = require('../controllers/blogController');
const designCtrl     = require('../controllers/designController');
const voucherCtrl    = require('../controllers/voucherController');
const paymentCtrl    = require('../controllers/paymentController');
const uploadCtrl     = require('../controllers/uploadController');
const pbiCtrl        = require('../controllers/powerbiController');

const { protect, authorize, optionalAuth } = require('../middleware/auth');
const {
  validateRegister, validateLogin,
  validateUpdateProfile, validateChangePassword,
  validateProduct, validateOrder,
} = require('../middleware/validate');
const { trackViewMiddleware } = require('../middleware/trackInteraction');

// Fix 2: Single unified cache – redis with in-memory fallback
const { cacheMiddleware, delPattern } = require('../config/redis');

// AI Service client
const aiService = require('../services/aiService');
const { query, sql, getPool } = require('../config/db');

// Invalidate helpers
const clearProductCache  = (req, res, next) => {
  res.on('finish', () => { if (res.statusCode < 400) delPattern('cache:*products*'); });
  next();
};
const clearCategoryCache = (req, res, next) => {
  res.on('finish', () => { if (res.statusCode < 400) delPattern('cache:*categories*'); });
  next();
};
const clearBlogCache     = (req, res, next) => {
  res.on('finish', () => { if (res.statusCode < 400) delPattern('cache:*blog*'); });
  next();
};

router.post('/auth/register',         validateRegister,        authCtrl.register);
router.post('/auth/login',            validateLogin,           authCtrl.login);
router.get ('/auth/me',               protect,                 authCtrl.getMe);
router.put ('/auth/update-profile',   protect, validateUpdateProfile,  authCtrl.updateProfile);
router.put ('/auth/change-password',  protect, validateChangePassword, authCtrl.changePassword);

router.get('/products',       cacheMiddleware(60,  'prod:'),  productCtrl.getProducts);
router.get('/products/:slug', optionalAuth, cacheMiddleware(120, 'prod:'), productCtrl.getProductBySlug);

router.get('/categories',       cacheMiddleware(300, 'cat:'), categoryCtrl.getCategories);
router.get('/categories/:slug', cacheMiddleware(300, 'cat:'), categoryCtrl.getCategoryBySlug);

router.get('/collections',        cacheMiddleware(300, 'col:'), collCtrl.getCollections);
router.get('/collections/:slug',  cacheMiddleware(120, 'col:'), collCtrl.getCollectionBySlug);

router.get   ('/cart',                protect, cartCtrl.getCart);
router.post  ('/cart/items',          protect, cartCtrl.addItem);
router.put   ('/cart/items/:itemId',  protect, cartCtrl.updateItem);
router.delete('/cart/items/:itemId',  protect, cartCtrl.removeItem);
router.delete('/cart',                protect, cartCtrl.clearCart);

router.post('/orders',     protect, validateOrder, orderCtrl.createOrder);
router.get ('/orders/my',  protect,               orderCtrl.getMyOrders);
router.get ('/orders/:id', protect,               orderCtrl.getOrderById);

router.get  ('/wishlist',            protect, wishlistCtrl.getWishlist);
router.post ('/wishlist/:productId', protect, wishlistCtrl.toggleWishlist);

router.post('/products/:productId/reviews', protect, reviewCtrl.addReview);

router.get('/blog',        cacheMiddleware(120, 'blog:'), blogCtrl.getPosts);
router.get('/blog/:slug',  cacheMiddleware(300, 'blog:'), blogCtrl.getPostBySlug);

router.post('/design-request', optionalAuth, designCtrl.submitRequest);

router.post('/vouchers/check', protect, voucherCtrl.checkVoucher);

router.post('/payment/vnpay-url',    protect, paymentCtrl.createVnpayUrl);
router.get ('/payment/vnpay-return', paymentCtrl.vnpayReturn);

router.post('/payment/momo-url',    protect, paymentCtrl.createMomoUrl);
router.post('/payment/momo-notify', paymentCtrl.momoNotify);
router.get ('/payment/momo-return', paymentCtrl.momoReturn);

router.post('/upload', protect, uploadCtrl.upload);

// AI PROXY – gọi Python AI service + enrich từ SQL

/** Enrich: gắn thêm thông tin sản phẩm từ SQL vào AI results */
async function enrichAI(results, pool) {
  if (!results?.length) return [];
  const productIds = results.map(r => parseInt(r.product_id, 10)).filter(Boolean);
  const ids = productIds.join(',');
  if (!ids) return results;
  try {
    const r = await pool.request().query(`
      SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.sold, p.stock,
             p.material, p.category_id, c.name AS category_name,
             pi.url AS image_url,
             (SELECT AVG(CAST(rv.rating AS FLOAT)) FROM Reviews rv WHERE rv.product_id = p.id) AS avg_rating
      FROM Products p
      LEFT JOIN Categories c       ON c.id = p.category_id
      LEFT JOIN ProductImages pi   ON pi.product_id = p.id AND pi.is_primary = 1
      WHERE p.id IN (${ids}) AND p.is_active = 1
    `);
    const map = Object.fromEntries(r.recordset.map(row => [String(row.id), row]));
    return results.map(item => ({ ...item, ...(map[String(item.product_id)] || {}) }));
  } catch { return results; }
}

async function resolveCategoryForAI(category) {
  if (!category || !String(category).trim()) return null;
  const raw = String(category).trim();
  if (!/^\d+$/.test(raw)) return raw;

  try {
    const result = await query(
      'SELECT name FROM Categories WHERE id = @id',
      [{ name: 'id', type: sql.Int, value: parseInt(raw, 10) }]
    );
    return result.recordset[0]?.name || raw;
  } catch {
    return raw;
  }
}

// Simple in-memory cache (5 min TTL)
const _aiCache = new Map();
function aiCached(key, fn, ttl = 300_000) {
  const hit = _aiCache.get(key);
  if (hit && Date.now() - hit.ts < ttl) return Promise.resolve(hit.data);
  return fn().then(data => { _aiCache.set(key, { data, ts: Date.now() }); return data; });
}

// GET /api/ai-proxy/search
router.get('/ai-proxy/search', async (req, res) => {
  const { q, limit = 12, category, material, price_min, price_max, min_score } = req.query;
  if (!q) return res.status(400).json({ error: 'Query "q" là bắt buộc' });
  const cacheKey = `search:${JSON.stringify(req.query)}`;
  const data = await aiCached(cacheKey, async () => {
    const aiCategory = await resolveCategoryForAI(category);
    const results = await aiService.semanticSearch(q, { limit, category: aiCategory, material, price_min, price_max, min_score });
    return await enrichAI(results, getPool());
  });
  res.json({ query: q, results: data, total: data.length });
});

// GET /api/ai-proxy/search/autocomplete
router.get('/ai-proxy/search/autocomplete', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json({ suggestions: [] });
  const suggestions = await aiCached(`ac:${q}`, async () => {
    const raw = await aiService.getSearchAutocomplete(q, 6);
    return await enrichAI(raw, getPool());
  }, 60_000);
  res.json({ query: q, suggestions });
});

// GET /api/ai-proxy/recommend/for-me  (requires auth)
router.get('/ai-proxy/recommend/for-me', protect, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 30);
  const cacheKey = `rec:${req.user.id}:${limit}`;
  const data = await aiCached(cacheKey, async () => {
    const recs = await aiService.getRecommendationsForUser(req.user.id, { limit });
    return await enrichAI(recs, getPool());
  });
  res.json({ results: data, total: data.length });
});

// GET /api/ai-proxy/recommend/popular
router.get('/ai-proxy/recommend/popular', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 30);
  const data = await aiCached(`popular:${limit}`, async () => {
    const recs = await aiService.getPopularProducts(limit);
    return await enrichAI(recs, getPool());
  });
  res.json({ results: data, total: data.length });
});

// GET /api/ai-proxy/recommend/co-purchase/:productId
router.get('/ai-proxy/recommend/co-purchase/:productId', async (req, res) => {
  const { productId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 8, 20);
  const data = await aiCached(`copurchase:${productId}:${limit}`, async () => {
    const recs = await aiService.getCoPurchase(productId, limit);
    return await enrichAI(recs, getPool());
  });
  res.json({ results: data, total: data.length });
});

// GET /api/ai-proxy/recommend/similar/:productId
router.get('/ai-proxy/recommend/similar/:productId', async (req, res) => {
  const { productId } = req.params;
  const limit = Math.min(parseInt(req.query.limit) || 6, 20);
  const data = await aiCached(`similar:${productId}:${limit}`, async () => {
    const results = await aiService.getSimilarProducts(productId, limit);
    return await enrichAI(results, getPool());
  });
  res.json({ results: data, total: data.length });
});

// POST /api/ai-proxy/recommend/for-cart
router.post('/ai-proxy/recommend/for-cart', async (req, res) => {
  const { product_ids } = req.body;
  if (!product_ids?.length) return res.json({ results: [], total: 0 });
  const recs = await aiService.getCartRecommendations(product_ids, 8);
  const data = await enrichAI(recs, getPool());
  res.json({ results: data, total: data.length });
});

// ADMIN (protect + authorize('admin') trên toàn bộ)
const admin = express.Router();
admin.use(protect, authorize('admin'));

// Dashboard
admin.get('/dashboard', adminCtrl.getDashboard);

// Users
admin.get  ('/users',              adminCtrl.getUsers);
admin.patch('/users/:id/toggle',   adminCtrl.toggleUserStatus);
admin.patch('/users/:id/role',     adminCtrl.updateUserRole);

// Products
admin.get   ('/products',          productCtrl.getProducts);
admin.post  ('/products',          validateProduct, clearProductCache, productCtrl.createProduct);
admin.put   ('/products/:id',      clearProductCache, productCtrl.updateProduct);
admin.delete('/products/:id',      clearProductCache, productCtrl.deleteProduct);

// Orders
admin.get  ('/orders',             orderCtrl.getAdminOrders);
admin.patch('/orders/:id/status',  orderCtrl.updateOrderStatus);

// Collections
admin.get   ('/collections',                           collCtrl.getCollections);
admin.post  ('/collections',                           collCtrl.createCollection);
admin.delete('/collections/:id',                       collCtrl.deleteCollection);
admin.post  ('/collections/:id/products',              collCtrl.addProduct);
admin.delete('/collections/:id/products/:productId',   collCtrl.removeProduct);

// Blog
admin.get   ('/blog',              blogCtrl.getPosts);
admin.post  ('/blog',              clearBlogCache, blogCtrl.createPost);
admin.put   ('/blog/:id',          clearBlogCache, blogCtrl.updatePost);
admin.delete('/blog/:id',          clearBlogCache, blogCtrl.deletePost);

// Vouchers
admin.get   ('/vouchers',          voucherCtrl.getVouchers);
admin.post  ('/vouchers',          voucherCtrl.createVoucher);
admin.delete('/vouchers/:id',      voucherCtrl.deleteVoucher);

// Design requests
admin.get  ('/design-requests',    designCtrl.getRequests);
admin.patch('/design-requests/:id',designCtrl.updateStatus);

// Analytics & Power BI
admin.get('/powerbi/token',        pbiCtrl.getEmbedToken);
admin.get('/powerbi/reports',      pbiCtrl.getReports);

router.use('/admin', admin);

module.exports = router;
