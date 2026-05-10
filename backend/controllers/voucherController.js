const { query, sql } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

exports.checkVoucher = async (req, res, next) => {
  const { code, subtotal } = req.body;

  const result = await query(
    `SELECT * FROM Vouchers
     WHERE code = @code AND is_active = 1
       AND (start_date IS NULL OR start_date <= GETDATE())
       AND (end_date   IS NULL OR end_date   >= GETDATE())
       AND (usage_limit IS NULL OR used_count < usage_limit)`,
    [{ name: 'code', type: sql.VarChar, value: code }]
  );

  const v = result.recordset[0];
  if (!v) return next(new AppError('Mã giảm giá không hợp lệ hoặc đã hết hạn', 400));
  if (subtotal < v.min_order)
    return next(new AppError(`Đơn hàng tối thiểu ${v.min_order.toLocaleString()}đ để dùng mã này`, 400));

  let discount = v.type === 'percent' ? subtotal * (v.value / 100) : v.value;
  if (v.max_discount) discount = Math.min(discount, v.max_discount);

  res.json({ success: true, data: { code: v.code, type: v.type, discount } });
};

exports.getVouchers = async (req, res) => {
  const result = await query('SELECT * FROM Vouchers ORDER BY created_at DESC');
  res.json({ success: true, data: result.recordset });
};

exports.createVoucher = async (req, res) => {
  const { code, type, value, min_order, max_discount, usage_limit, start_date, end_date } = req.body;

  await query(
    `INSERT INTO Vouchers (code, type, value, min_order, max_discount, usage_limit, start_date, end_date)
     VALUES (@c, @t, @v, @mo, @md, @ul, @sd, @ed)`,
    [
      { name: 'c',  type: sql.VarChar,  value: code.toUpperCase() },
      { name: 't',  type: sql.VarChar,  value: type },
      { name: 'v',  type: sql.Decimal,  value: parseFloat(value) },
      { name: 'mo', type: sql.Decimal,  value: parseFloat(min_order) || 0 },
      { name: 'md', type: sql.Decimal,  value: max_discount ? parseFloat(max_discount) : null },
      { name: 'ul', type: sql.Int,      value: usage_limit  ? parseInt(usage_limit)   : null },
      { name: 'sd', type: sql.DateTime, value: start_date || null },
      { name: 'ed', type: sql.DateTime, value: end_date   || null },
    ]
  );

  res.status(201).json({ success: true, message: 'Tạo voucher thành công' });
};

exports.deleteVoucher = async (req, res) => {
  await query(
    'UPDATE Vouchers SET is_active = 0 WHERE id = @id',
    [{ name: 'id', type: sql.Int, value: parseInt(req.params.id) }]
  );
  res.json({ success: true });
};
