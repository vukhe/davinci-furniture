const { query, sql } = require('../config/db');

exports.submitRequest = async (req, res) => {
  const { full_name, phone, email, description } = req.body;

  await query(
    `INSERT INTO DesignRequests (user_id, full_name, phone, email, description)
     VALUES (@uid, @name, @phone, @email, @desc)`,
    [
      { name: 'uid',   type: sql.Int,      value: req.user?.id || null },
      { name: 'name',  type: sql.NVarChar, value: full_name },
      { name: 'phone', type: sql.VarChar,  value: phone },
      { name: 'email', type: sql.VarChar,  value: email || null },
      { name: 'desc',  type: sql.NVarChar, value: description || null },
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Đã gửi yêu cầu thành công! Chúng tôi sẽ liên hệ sớm nhất.',
  });
};

exports.getRequests = async (req, res) => {
  const { status } = req.query;
  const inputs = [];
  let where = '';

  if (status) {
    where = 'WHERE status = @status';
    inputs.push({ name: 'status', type: sql.VarChar, value: status });
  }

  const result = await query(
    `SELECT * FROM DesignRequests ${where} ORDER BY created_at DESC`,
    inputs
  );

  res.json({ success: true, data: result.recordset });
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  await query(
    'UPDATE DesignRequests SET status = @s WHERE id = @id',
    [
      { name: 's',  type: sql.VarChar, value: status },
      { name: 'id', type: sql.Int,     value: parseInt(req.params.id) },
    ]
  );
  res.json({ success: true });
};
