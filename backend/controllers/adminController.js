const { getDashboardOptimized } = require('../config/db_optimized');
const { query, sql }            = require('../config/db');
const { AppError }              = require('../middleware/errorHandler');

// ── GET /api/admin/dashboard ──────────────────────────
exports.getDashboard = async (req, res) => {
  const period = parseInt(req.query.period) || 30;
  const data   = await getDashboardOptimized(period);
  res.json({ success: true, data });
};

// ── GET /api/admin/users ──────────────────────────────
exports.getUsers = async (req, res) => {
  const { page = 1, limit = 20, search, role } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const inputs = [];
  const conditions = [];

  if (search) {
    conditions.push('(u.name LIKE @search OR u.email LIKE @search)');
    inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
  }
  if (role && ['user', 'admin'].includes(role)) {
    conditions.push('u.role = @role');
    inputs.push({ name: 'role', type: sql.VarChar, value: role });
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  inputs.push(
    { name: 'offset', type: sql.Int, value: offset },
    { name: 'limit',  type: sql.Int, value: parseInt(limit) }
  );

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM Users u ${where}`,
    inputs.slice(0, conditions.length)
  );

  const result = await query(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.is_active, u.created_at,
            (SELECT COUNT(*) FROM Orders WHERE user_id = u.id) AS order_count
     FROM Users u
     ${where}
     ORDER BY u.created_at DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    inputs
  );

  res.json({
    success: true,
    data: result.recordset,
    pagination: {
      page: parseInt(page), limit: parseInt(limit),
      total: countResult.recordset[0].total,
      pages: Math.ceil(countResult.recordset[0].total / parseInt(limit)),
    },
  });
};

// ── PATCH /api/admin/users/:id/toggle ─────────────────
exports.toggleUserStatus = async (req, res, next) => {
  const targetId = parseInt(req.params.id);

  if (targetId === req.user.id)
    return next(new AppError('Không thể khóa tài khoản của chính mình', 400));

  const target = await query(
    'SELECT role, is_active FROM Users WHERE id = @id',
    [{ name: 'id', type: sql.Int, value: targetId }]
  );
  if (!target.recordset[0])
    return next(new AppError('Người dùng không tồn tại', 404));
  if (target.recordset[0].role === 'admin')
    return next(new AppError('Không thể khóa tài khoản admin khác', 403));

  await query(
    'UPDATE Users SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = GETDATE() WHERE id = @id',
    [{ name: 'id', type: sql.Int, value: targetId }]
  );

  const action = target.recordset[0].is_active ? 'khóa' : 'mở khóa';
  res.json({ success: true, message: `Đã ${action} tài khoản thành công` });
};

// ── PATCH /api/admin/users/:id/role ───────────────────
exports.updateUserRole = async (req, res, next) => {
  const { role }   = req.body;
  const targetId   = parseInt(req.params.id);

  if (!['user', 'admin'].includes(role))
    return next(new AppError('Role không hợp lệ. Chỉ chấp nhận: user, admin', 400));

  if (targetId === req.user.id && role !== 'admin')
    return next(new AppError('Không thể tự hạ quyền của chính mình', 400));

  const target = await query(
    'SELECT id FROM Users WHERE id = @id',
    [{ name: 'id', type: sql.Int, value: targetId }]
  );
  if (!target.recordset[0])
    return next(new AppError('Người dùng không tồn tại', 404));

  await query(
    'UPDATE Users SET role = @role, updated_at = GETDATE() WHERE id = @id',
    [
      { name: 'role', type: sql.VarChar, value: role },
      { name: 'id',   type: sql.Int,     value: targetId },
    ]
  );

  res.json({ success: true, message: `Đã cập nhật role thành "${role}"` });
};
