/**
 * backend/services/aiService.js
 * Tích hợp với Python AI Service (FastAPI :8000)
 * Dùng trong productController.js và adminController.js
 */
const axios = require("axios");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const AI_TIMEOUT = parseInt(process.env.AI_TIMEOUT_MS || "5000");

const aiClient = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: AI_TIMEOUT,
});

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Semantic search – gọi AI service thay vì SQL LIKE
 * @param {string} query - Từ khóa tìm kiếm
 * @param {object} options - { limit, category }
 * @returns {Promise<Array>} - Danh sách product_id theo thứ tự liên quan
 */
async function semanticSearch(query, { limit = 10, category = null, material = null, price_min = null, price_max = null, min_score = null } = {}) {
  try {
    const params = { q: query, limit };
    if (category)  params.category  = category;
    if (material)  params.material  = material;
    if (price_min) params.price_min = price_min;
    if (price_max) params.price_max = price_max;
    if (min_score) params.min_score = min_score;

    const { data } = await aiClient.get("/api/ai/search/semantic", { params });
    return data.results || [];
  } catch (err) {
    console.warn("[AI Service] Semantic search failed, fallback to SQL:", err.message);
    return null; // null → caller sẽ dùng SQL search thông thường
  }
}

/**
 * Similar products – dùng trong ProductDetailPage
 * @param {string} productId
 * @param {number} limit
 */
async function getSimilarProducts(productId, limit = 6) {
  try {
    const { data } = await aiClient.get(`/api/ai/search/similar/${productId}`, {
      params: { limit },
    });
    return data.results || [];
  } catch (err) {
    console.warn("[AI Service] Similar products failed:", err.message);
    return [];
  }
}

// ── Recommendations ───────────────────────────────────────────────────────────

/**
 * Gợi ý sản phẩm cho user cụ thể
 * @param {number} userId
 * @param {object} options - { limit, excludeProductIds }
 */
async function getRecommendationsForUser(userId, { limit = 10, excludeProductIds = [] } = {}) {
  try {
    const { data } = await aiClient.get(`/api/ai/recommend/for-user/${userId}`, {
      params: {
        limit,
        exclude: excludeProductIds.join(","),
      },
    });
    return data.results || [];
  } catch (err) {
    console.warn("[AI Service] Recommendations failed:", err.message);
    return [];
  }
}

/**
 * Sản phẩm phổ biến (fallback cho user chưa đăng nhập)
 */
async function getPopularProducts(limit = 10) {
  try {
    const { data } = await aiClient.get("/api/ai/recommend/popular", {
      params: { limit },
    });
    return data.results || [];
  } catch (err) {
    console.warn("[AI Service] Popular products failed:", err.message);
    return [];
  }
}

/**
 * Trigger retrain recommender sau khi có đơn hàng mới
 * Gọi trong orderController.js sau khi tạo order thành công
 */
async function triggerRecommenderRetrain() {
  try {
    await aiClient.post("/api/ai/recommend/retrain");
    console.log("[AI Service] Recommender retrain triggered");
  } catch (err) {
    // Non-critical – chỉ log, không throw
    console.warn("[AI Service] Could not trigger retrain:", err.message);
  }
}

// ── Forecasting ───────────────────────────────────────────────────────────────

/**
 * Dự đoán doanh thu – dùng trong AdminDashboard
 * @param {number} horizon - Số ngày dự đoán (7-90)
 * @param {string} adminToken - JWT token của admin
 */
async function forecastRevenue(horizon = 30, adminToken) {
  try {
    const { data } = await aiClient.get("/api/ai/forecast/revenue", {
      params: { horizon, admin_token: adminToken },
    });
    return data;
  } catch (err) {
    console.warn("[AI Service] Forecast failed:", err.message);
    return null;
  }
}

/**
 * Sản phẩm trending – dùng trong AdminAnalytics
 */
async function getTrendingProducts(days = 30, limit = 10, adminToken) {
  try {
    const { data } = await aiClient.get("/api/ai/forecast/trending-products", {
      params: { days, limit, admin_token: adminToken },
    });
    return data.trending || [];
  } catch (err) {
    console.warn("[AI Service] Trending failed:", err.message);
    return [];
  }
}

/**
 * Dữ liệu doanh thu lịch sử
 */
async function getHistoricalRevenue(adminToken) {
  try {
    const { data } = await aiClient.get("/api/ai/forecast/historical", {
      params: { admin_token: adminToken },
    });
    return data;
  } catch (err) {
    console.warn("[AI Service] Historical revenue failed:", err.message);
    return null;
  }
}

// ── Health check ──────────────────────────────────────────────────────────────

async function checkAIServiceHealth() {
  try {
    const { data } = await aiClient.get("/health", { timeout: 2000 });
    return { available: true, ...data };
  } catch {
    return { available: false };
  }
}

// (exports consolidated below)
// ── Item-Based (Co-purchase + Similar CF) ─────────────────────────────────────

/**
 * "Khách hàng cũng mua" – co-purchase từ OrderItems
 */
async function getCoPurchase(productId, limit = 8) {
  try {
    const { data } = await aiClient.get(`/api/ai/recommend/co-purchase/${productId}`, {
      params: { limit },
    });
    return data.results || [];
  } catch (err) {
    console.warn('[AI Service] Co-purchase failed:', err.message);
    return [];
  }
}

/**
 * Gợi ý dựa trên giỏ hàng (aggregate co-purchase)
 */
async function getCartRecommendations(productIds, limit = 8) {
  try {
    const { data } = await aiClient.post('/api/ai/recommend/for-cart', { product_ids: productIds }, {
      params: { limit },
    });
    return data.results || [];
  } catch (err) {
    console.warn('[AI Service] Cart recommendations failed:', err.message);
    return [];
  }
}

/**
 * Autocomplete cho search bar
 */
async function getSearchAutocomplete(query, limit = 6) {
  try {
    const { data } = await aiClient.get('/api/ai/search/autocomplete', {
      params: { q: query, limit },
    });
    return data.suggestions || [];
  } catch (err) {
    return [];
  }
}

module.exports = {
  semanticSearch,
  getSimilarProducts,
  getRecommendationsForUser,
  getPopularProducts,
  triggerRecommenderRetrain,
  forecastRevenue,
  getTrendingProducts,
  getHistoricalRevenue,
  checkAIServiceHealth,
  getCoPurchase,
  getCartRecommendations,
  getSearchAutocomplete,
};
