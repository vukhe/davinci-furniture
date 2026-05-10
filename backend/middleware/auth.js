const jwt = require('jsonwebtoken');
const { query, sql } = require('../config/db');

// ── Middleware 1: Xác thực JWT ────────────────────────
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Luôn lấy user mới nhất từ DB (để phát hiện bị khóa ngay lập tức)
    const result = await query(
      'SELECT id, name, email, role, is_active FROM Users WHERE id = @id',
      [{ name: 'id', type: sql.Int, value: decoded.id }]
    );

    const user = result.recordset[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'Tài khoản không tồn tại' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa. Liên hệ admin.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' });
    }
    return res.status(401).json({ success: false, message: 'Token không hợp lệ' });
  }
};

// ── Middleware 2: Phân quyền theo role ─────────────────
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền. Yêu cầu role: [${roles.join(', ')}]`,
      });
    }
    next();
  };
};

// ── Middleware 3: Chỉ cho phép thao tác trên chính mình ─
// Dùng cho: user chỉ sửa/xem data của mình, admin được tất cả
exports.ownerOrAdmin = (idParam = 'id') => {
  return (req, res, next) => {
    const targetId = parseInt(req.params[idParam]);
    const isOwner  = req.user.id === targetId;
    const isAdmin  = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Bạn chỉ có thể thao tác trên tài khoản của chính mình',
      });
    }
    next();
  };
};

// ── Middleware 4: Optional auth (không bắt buộc đăng nhập) ─
// Dùng cho route public nhưng muốn biết user nếu đã đăng nhập
exports.optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const token   = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result  = await query(
      'SELECT id, name, email, role, is_active FROM Users WHERE id = @id AND is_active = 1',
      [{ name: 'id', type: sql.Int, value: decoded.id }]
    );
    if (result.recordset[0]) req.user = result.recordset[0];
  } catch {}

  next();
};
