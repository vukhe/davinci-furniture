/**
 * Input validation middleware
 * Chặn: empty fields, quá ngắn, SQL injection patterns, XSS
 */

const { AppError } = require('./errorHandler');

// Sanitize string: trim + giới hạn độ dài
const sanitize = (val, maxLen = 500) =>
  typeof val === 'string' ? val.trim().slice(0, maxLen) : val;

// Kiểm tra email format
const isEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Kiểm tra có ký tự SQL injection nguy hiểm không
const hasSQLInjection = (val) =>
  typeof val === 'string' && /('|--|;|\/\*|\*\/|xp_|exec\s|union\s|select\s|insert\s|drop\s|delete\s|update\s)/i.test(val);

// ── Validate Register ──────────────────────────────────
exports.validateRegister = (req, res, next) => {
  let { name, email, password, phone } = req.body;

  name     = sanitize(name, 100);
  email    = sanitize(email, 150)?.toLowerCase();
  password = sanitize(password, 100);
  phone    = sanitize(phone, 20);

  const errors = [];

  if (!name || name.length < 2)       errors.push('Họ tên tối thiểu 2 ký tự');
  if (!email || !isEmail(email))       errors.push('Email không hợp lệ');
  if (!password || password.length < 6) errors.push('Mật khẩu tối thiểu 6 ký tự');
  if (phone && !/^[0-9+\-\s]{8,15}$/.test(phone)) errors.push('Số điện thoại không hợp lệ');

  if ([name, email, password].some(hasSQLInjection))
    errors.push('Dữ liệu chứa ký tự không hợp lệ');

  if (errors.length) return next(new AppError(errors[0], 400));

  // Gán lại đã sanitize
  req.body = { ...req.body, name, email, password, phone };
  next();
};

// ── Validate Login ─────────────────────────────────────
exports.validateLogin = (req, res, next) => {
  let { email, password } = req.body;
  email    = sanitize(email, 150)?.toLowerCase();
  password = sanitize(password, 100);

  if (!email || !isEmail(email))  return next(new AppError('Email không hợp lệ', 400));
  if (!password)                   return next(new AppError('Vui lòng nhập mật khẩu', 400));

  req.body = { ...req.body, email, password };
  next();
};

// ── Validate Update Profile ───────────────────────────
exports.validateUpdateProfile = (req, res, next) => {
  let { name, phone } = req.body;
  name  = sanitize(name, 100);
  phone = sanitize(phone, 20);

  if (!name || name.length < 2) return next(new AppError('Họ tên tối thiểu 2 ký tự', 400));
  if (hasSQLInjection(name))    return next(new AppError('Tên chứa ký tự không hợp lệ', 400));
  if (phone && !/^[0-9+\-\s]{8,15}$/.test(phone)) return next(new AppError('Số điện thoại không hợp lệ', 400));

  req.body = { ...req.body, name, phone };
  next();
};

// ── Validate Change Password ──────────────────────────
exports.validateChangePassword = (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword)               return next(new AppError('Vui lòng nhập mật khẩu hiện tại', 400));
  if (!newPassword || newPassword.length < 6) return next(new AppError('Mật khẩu mới tối thiểu 6 ký tự', 400));
  if (currentPassword === newPassword) return next(new AppError('Mật khẩu mới phải khác mật khẩu cũ', 400));
  next();
};

// ── Validate Product ──────────────────────────────────
exports.validateProduct = (req, res, next) => {
  const { name, price, category_id } = req.body;
  const errors = [];

  if (!name || sanitize(name).length < 2)   errors.push('Tên sản phẩm tối thiểu 2 ký tự');
  if (!price || isNaN(price) || price <= 0)  errors.push('Giá sản phẩm không hợp lệ');
  if (!category_id || isNaN(category_id))    errors.push('Danh mục không hợp lệ');

  if (errors.length) return next(new AppError(errors[0], 400));
  next();
};

// ── Validate Order ────────────────────────────────────
exports.validateOrder = (req, res, next) => {
  const { items, shipping_name, shipping_phone, shipping_addr } = req.body;
  const errors = [];

  if (!items || !Array.isArray(items) || items.length === 0) errors.push('Giỏ hàng trống');
  if (!shipping_name || shipping_name.trim().length < 2)     errors.push('Vui lòng nhập họ tên người nhận');
  if (!shipping_phone || !/^[0-9+\-\s]{8,15}$/.test(shipping_phone)) errors.push('Số điện thoại không hợp lệ');
  if (!shipping_addr || shipping_addr.trim().length < 5)     errors.push('Vui lòng nhập địa chỉ giao hàng');

  if (errors.length) return next(new AppError(errors[0], 400));
  next();
};
