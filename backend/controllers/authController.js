const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { query, sql } = require('../config/db');
const { AppError }   = require('../middleware/errorHandler');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const safeUser = (u) => {
  const { password, ...rest } = u;
  return rest;
};

// ── POST /api/auth/register ───────────────────────────
exports.register = async (req, res, next) => {
  const { name, email, password, phone } = req.body;
  // validate đã được xử lý bởi validateRegister middleware

  const exists = await query(
    'SELECT id FROM Users WHERE email = @email',
    [{ name: 'email', type: sql.VarChar, value: email }]
  );
  if (exists.recordset.length > 0) {
    return next(new AppError('Email đã được sử dụng', 400));
  }

  const hashed = await bcrypt.hash(password, 12);

  const result = await query(
    `INSERT INTO Users (name, email, password, phone, role)
     OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role, INSERTED.phone
     VALUES (@name, @email, @password, @phone, 'user')`,
    [
      { name: 'name',     type: sql.NVarChar, value: name },
      { name: 'email',    type: sql.VarChar,  value: email },
      { name: 'password', type: sql.VarChar,  value: hashed },
      { name: 'phone',    type: sql.VarChar,  value: phone || null },
    ]
  );

  const user  = result.recordset[0];
  const token = signToken(user.id);

  res.status(201).json({ success: true, token, user });
};

// ── POST /api/auth/login ──────────────────────────────
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  const result = await query(
    'SELECT * FROM Users WHERE email = @email',
    [{ name: 'email', type: sql.VarChar, value: email }]
  );

  const user = result.recordset[0];

  // Không phân biệt "sai email" / "sai password" → tránh user enumeration
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return next(new AppError('Email hoặc mật khẩu không đúng', 401));
  }

  if (!user.is_active) {
    return next(new AppError('Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.', 403));
  }

  const token = signToken(user.id);
  res.json({ success: true, token, user: safeUser(user) });
};

// ── GET /api/auth/me ──────────────────────────────────
exports.getMe = async (req, res) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar, u.created_at,
            (SELECT COUNT(*) FROM Orders    WHERE user_id = u.id) AS total_orders,
            (SELECT COUNT(*) FROM Wishlists WHERE user_id = u.id) AS wishlist_count
     FROM Users u WHERE u.id = @id`,
    [{ name: 'id', type: sql.Int, value: req.user.id }]
  );
  res.json({ success: true, user: result.recordset[0] });
};

// ── PUT /api/auth/update-profile ──────────────────────
exports.updateProfile = async (req, res, next) => {
  const { name, phone } = req.body;
  // KHÔNG cho phép cập nhật role qua đây

  await query(
    'UPDATE Users SET name = @name, phone = @phone, updated_at = GETDATE() WHERE id = @id',
    [
      { name: 'name',  type: sql.NVarChar, value: name },
      { name: 'phone', type: sql.VarChar,  value: phone || null },
      { name: 'id',    type: sql.Int,      value: req.user.id },
    ]
  );
  res.json({ success: true, message: 'Cập nhật thành công' });
};

// ── PUT /api/auth/change-password ─────────────────────
exports.changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const result = await query(
    'SELECT password FROM Users WHERE id = @id',
    [{ name: 'id', type: sql.Int, value: req.user.id }]
  );

  const user = result.recordset[0];
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    return next(new AppError('Mật khẩu hiện tại không đúng', 400));
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await query(
    'UPDATE Users SET password = @password, updated_at = GETDATE() WHERE id = @id',
    [
      { name: 'password', type: sql.VarChar, value: hashed },
      { name: 'id',       type: sql.Int,     value: req.user.id },
    ]
  );
  res.json({ success: true, message: 'Đổi mật khẩu thành công' });
};
