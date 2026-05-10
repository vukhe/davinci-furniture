import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor – attach token từ localStorage (kept in sync by login/logout)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor – handle 401
api.interceptors.response.use(
  (res) => res.data,
  (error) => {
    const message = error.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại';
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject({ message, status: error.response?.status });
  }
);

// ── Auth ──────────────────────────────────────────────
export const authAPI = {
  register:       (data) => api.post('/auth/register', data),
  login:          (data) => api.post('/auth/login', data),
  getMe:          ()     => api.get('/auth/me'),
  updateProfile:  (data) => api.put('/auth/update-profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// ── Products ──────────────────────────────────────────
export const productAPI = {
  getAll:       (params) => api.get('/products', { params }),
  getBySlug:    (slug)   => api.get(`/products/${slug}`),
  getFeatured:  ()       => api.get('/products', { params: { featured: true, limit: 8 } }),
  getBestSelling: ()     => api.get('/products', { params: { sort: 'sold', limit: 8 } }),
};

// ── Categories ────────────────────────────────────────
export const categoryAPI = {
  getAll:    () => api.get('/categories'),
  getBySlug: (slug) => api.get(`/categories/${slug}`),
};

// ── Collections ───────────────────────────────────────
export const collectionAPI = {
  getAll:    ()     => api.get('/collections'),
  getBySlug: (slug) => api.get(`/collections/${slug}`),
};

// ── Cart ──────────────────────────────────────────────
export const cartAPI = {
  get:        ()              => api.get('/cart'),
  addItem:    (data)          => api.post('/cart/items', data),
  updateItem: (itemId, data)  => api.put(`/cart/items/${itemId}`, data),
  removeItem: (itemId)        => api.delete(`/cart/items/${itemId}`),
  clear:      ()              => api.delete('/cart'),
};

// ── Orders ────────────────────────────────────────────
export const orderAPI = {
  create:    (data)   => api.post('/orders', data),
  getMyAll:  (params) => api.get('/orders/my', { params }),
  getById:   (id)     => api.get(`/orders/${id}`),
};

// ── Wishlist ──────────────────────────────────────────
export const wishlistAPI = {
  get:    ()          => api.get('/wishlist'),
  toggle: (productId) => api.post(`/wishlist/${productId}`),
};

// ── Reviews ───────────────────────────────────────────
export const reviewAPI = {
  add: (productId, data) => api.post(`/products/${productId}/reviews`, data),
};

// ── Blog ──────────────────────────────────────────────
export const blogAPI = {
  getAll:    (params) => api.get('/blog', { params }),
  getBySlug: (slug)   => api.get(`/blog/${slug}`),
};

// ── Voucher ───────────────────────────────────────────
export const voucherAPI = {
  check: (data) => api.post('/vouchers/check', data),
};

// ── Design Request ────────────────────────────────────
export const designAPI = {
  submit: (data) => api.post('/design-request', data),
};



// ── Admin ─────────────────────────────────────────────
export const adminAPI = {
  getDashboard: (params)      => api.get('/admin/dashboard', { params }),
  getUsers:     (params)      => api.get('/admin/users', { params }),
  toggleUser:   (id)          => api.patch(`/admin/users/${id}/toggle`),
  updateUserRole:(id, role)   => api.patch(`/admin/users/${id}/role`, { role }),

  getProducts:    (params)    => api.get('/admin/products', { params }),
  createProduct:  (data)      => api.post('/admin/products', data),
  updateProduct:  (id, data)  => api.put(`/admin/products/${id}`, data),
  deleteProduct:  (id)        => api.delete(`/admin/products/${id}`),

  getOrders:      (params)    => api.get('/admin/orders', { params }),
  updateOrderStatus: (id, s)  => api.patch(`/admin/orders/${id}/status`, { status: s }),

  getBlog:        (params)    => api.get('/admin/blog', { params }),
  createPost:     (data)      => api.post('/admin/blog', data),
  updatePost:     (id, data)  => api.put(`/admin/blog/${id}`, data),
  deletePost:     (id)        => api.delete(`/admin/blog/${id}`),

  getVouchers:    ()          => api.get('/admin/vouchers'),
  createVoucher:  (data)      => api.post('/admin/vouchers', data),
  deleteVoucher:  (id)        => api.delete(`/admin/vouchers/${id}`),

  getDesignRequests: ()       => api.get('/admin/design-requests'),
  uploadImage:    (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  updateDesignStatus:(id, s)  => api.patch(`/admin/design-requests/${id}`, { status: s }),

  // Collections management
  getCollections:       ()       => api.get('/admin/collections'),
  createCollection:     (data)   => api.post('/admin/collections', data),
  deleteCollection:     (id)     => api.delete(`/admin/collections/${id}`),
  addProductToCollection:   (id, data) => api.post(`/admin/collections/${id}/products`, data),
  removeProductFromCollection: (id, pid) => api.delete(`/admin/collections/${id}/products/${pid}`),

  // Analytics & Power BI
  getAdminReports:   (params) => api.get('/admin/powerbi/reports', { params }),
  getPowerBIToken:   ()       => api.get('/admin/powerbi/token'),
};

export default api;

// ── Payment ────────────────────────────────────────────────
export const paymentAPI = {
  createVnpayUrl: (data) => api.post('/payment/vnpay-url', data),
  createMomoUrl:  (data) => api.post('/payment/momo-url',  data),
};
