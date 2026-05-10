const { query, sql, getPool } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { trackOrderPurchase, triggerRetrain } = require('../middleware/trackInteraction');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const generateOrderCode = () => 'DV' + Date.now().toString().slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();

// POST /api/orders
exports.createOrder = async (req, res, next) => {
  const {
    items, shipping_name, shipping_phone, shipping_addr,
    payment_method = 'cod', note, voucher_code,
  } = req.body;

  if (!items || items.length === 0) return next(new AppError('Giỏ hàng trống', 400));

  // Validate products & calculate subtotal
  let subtotal = 0;
  const validatedItems = [];

  for (const item of items) {
    const result = await query(
      'SELECT id, name, price, sale_price, stock FROM Products WHERE id = @id AND is_active = 1',
      [{ name: 'id', type: sql.Int, value: item.product_id }]
    );
    const product = result.recordset[0];
    if (!product) return next(new AppError(`Sản phẩm ID ${item.product_id} không tồn tại`, 400));
    if (product.stock < item.quantity) return next(new AppError(`Sản phẩm "${product.name}" không đủ hàng`, 400));

    const unitPrice = product.sale_price || product.price;
    subtotal += unitPrice * item.quantity;

    const imgResult = await query(
      'SELECT TOP 1 url FROM ProductImages WHERE product_id = @id AND is_primary = 1',
      [{ name: 'id', type: sql.Int, value: product.id }]
    );

    validatedItems.push({
      ...item,
      name: product.name,
      price: unitPrice,
      image: imgResult.recordset[0]?.url || null,
    });
  }

  // Voucher
  let discount = 0, voucherId = null;
  if (voucher_code) {
    const vResult = await query(
      `SELECT * FROM Vouchers WHERE code = @code AND is_active = 1
       AND (start_date IS NULL OR start_date <= GETDATE())
       AND (end_date IS NULL OR end_date >= GETDATE())
       AND (usage_limit IS NULL OR used_count < usage_limit)`,
      [{ name: 'code', type: sql.VarChar, value: voucher_code }]
    );
    const voucher = vResult.recordset[0];
    if (!voucher) return next(new AppError('Mã giảm giá không hợp lệ', 400));
    if (subtotal < voucher.min_order) return next(new AppError(`Đơn hàng tối thiểu ${voucher.min_order.toLocaleString()}đ`, 400));

    if (voucher.type === 'percent') {
      discount = subtotal * (voucher.value / 100);
      if (voucher.max_discount) discount = Math.min(discount, voucher.max_discount);
    } else {
      discount = voucher.value;
    }
    voucherId = voucher.id;
  }

  const shipping_fee = subtotal >= 5000000 ? 0 : 50000;
  const total = subtotal - discount + shipping_fee;
  const order_code = generateOrderCode();

  // Insert order
  const orderResult = await query(
    `INSERT INTO Orders (order_code, user_id, shipping_name, shipping_phone, shipping_addr,
       subtotal, discount, shipping_fee, total, voucher_id, payment_method, note)
     OUTPUT INSERTED.id
     VALUES (@code, @userId, @sName, @sPhone, @sAddr,
       @subtotal, @discount, @fee, @total, @vId, @pm, @note)`,
    [
      { name: 'code',     type: sql.VarChar,  value: order_code },
      { name: 'userId',   type: sql.Int,      value: req.user.id },
      { name: 'sName',    type: sql.NVarChar, value: shipping_name },
      { name: 'sPhone',   type: sql.VarChar,  value: shipping_phone },
      { name: 'sAddr',    type: sql.NVarChar, value: shipping_addr },
      { name: 'subtotal', type: sql.Decimal,  value: subtotal },
      { name: 'discount', type: sql.Decimal,  value: discount },
      { name: 'fee',      type: sql.Decimal,  value: shipping_fee },
      { name: 'total',    type: sql.Decimal,  value: total },
      { name: 'vId',      type: sql.Int,      value: voucherId },
      { name: 'pm',       type: sql.VarChar,  value: payment_method },
      { name: 'note',     type: sql.NVarChar, value: note || null },
    ]
  );

  const orderId = orderResult.recordset[0].id;

  // Insert order items & update stock
  for (const item of validatedItems) {
    await query(
      `INSERT INTO OrderItems (order_id, product_id, variant_id, name, image, quantity, price)
       VALUES (@oid, @pid, @vid, @name, @img, @qty, @price)`,
      [
        { name: 'oid',   type: sql.Int,      value: orderId },
        { name: 'pid',   type: sql.Int,      value: item.product_id },
        { name: 'vid',   type: sql.Int,      value: item.variant_id || null },
        { name: 'name',  type: sql.NVarChar, value: item.name },
        { name: 'img',   type: sql.VarChar,  value: item.image },
        { name: 'qty',   type: sql.Int,      value: item.quantity },
        { name: 'price', type: sql.Decimal,  value: item.price },
      ]
    );

    await query(
      'UPDATE Products SET stock = stock - @qty, sold = sold + @qty WHERE id = @id',
      [
        { name: 'qty', type: sql.Int, value: item.quantity },
        { name: 'id',  type: sql.Int, value: item.product_id },
      ]
    );
  }

  // Update voucher usage
  if (voucherId) {
    await query(
      'UPDATE Vouchers SET used_count = used_count + 1 WHERE id = @id',
      [{ name: 'id', type: sql.Int, value: voucherId }]
    );
  }

  // ── AI Tracking: ghi purchase interactions (fire-and-forget) ──────────────
  setImmediate(async () => {
    try {
      const pool = getPool();
      const productIds = validatedItems.map(i => i.product_id);
      await trackOrderPurchase(pool, req.user.id, productIds);

      // Trigger retrain mỗi 20 đơn
      const cntRes = await query("SELECT COUNT(*) AS cnt FROM Orders WHERE status IN ('confirmed','completed')", []);
      if ((cntRes.recordset[0].cnt % 20) === 0) await triggerRetrain(AI_SERVICE_URL);
    } catch (e) { console.error('[Order] AI tracking error:', e.message); }
  });

  res.status(201).json({
    success: true,
    message: 'Đặt hàng thành công',
    data: { order_code, order_id: orderId, total, payment_method },
  });
};

// GET /api/orders/my
exports.getMyOrders = async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const inputs = [{ name: 'userId', type: sql.Int, value: req.user.id }];
  let statusFilter = '';
  if (status) {
    statusFilter = 'AND o.status = @status';
    inputs.push({ name: 'status', type: sql.VarChar, value: status });
  }

  inputs.push(
    { name: 'offset', type: sql.Int, value: offset },
    { name: 'limit',  type: sql.Int, value: parseInt(limit) }
  );

  const result = await query(
    `SELECT o.id, o.order_code, o.total, o.status, o.payment_method, o.payment_status, o.created_at,
            (SELECT COUNT(*) FROM OrderItems WHERE order_id = o.id) AS item_count,
            (SELECT TOP 1 image FROM OrderItems WHERE order_id = o.id) AS first_image
     FROM Orders o
     WHERE o.user_id = @userId ${statusFilter}
     ORDER BY o.created_at DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    inputs
  );

  res.json({ success: true, data: result.recordset });
};

// GET /api/orders/:id
exports.getOrderById = async (req, res, next) => {
  const result = await query(
    `SELECT o.*, u.name AS user_name, u.email AS user_email
     FROM Orders o JOIN Users u ON o.user_id = u.id
     WHERE o.id = @id AND (o.user_id = @userId OR @role = 'admin')`,
    [
      { name: 'id',     type: sql.Int,     value: parseInt(req.params.id) },
      { name: 'userId', type: sql.Int,     value: req.user.id },
      { name: 'role',   type: sql.VarChar, value: req.user.role },
    ]
  );

  const order = result.recordset[0];
  if (!order) return next(new AppError('Đơn hàng không tồn tại', 404));

  const items = await query(
    'SELECT * FROM OrderItems WHERE order_id = @id',
    [{ name: 'id', type: sql.Int, value: order.id }]
  );

  res.json({ success: true, data: { ...order, items: items.recordset } });
};

// GET /api/admin/orders
exports.getAdminOrders = async (req, res) => {
  const { page = 1, limit = 15, status, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const inputs = [];
  const conditions = [];

  if (status) {
    conditions.push('o.status = @status');
    inputs.push({ name: 'status', type: sql.VarChar, value: status });
  }
  if (search) {
    conditions.push('(o.order_code LIKE @search OR o.shipping_name LIKE @search OR o.shipping_phone LIKE @search)');
    inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRes = await query(`SELECT COUNT(*) AS total FROM Orders o ${where}`, inputs);
  const total = countRes.recordset[0].total;

  inputs.push(
    { name: 'offset', type: sql.Int, value: offset },
    { name: 'limit',  type: sql.Int, value: parseInt(limit) }
  );

  const result = await query(
    `SELECT o.id, o.order_code, o.total, o.status, o.payment_method, o.payment_status,
            o.shipping_name, o.shipping_phone, o.shipping_addr, o.note, o.created_at,
            u.name AS customer_name, u.email AS customer_email
     FROM Orders o JOIN Users u ON o.user_id = u.id
     ${where}
     ORDER BY o.created_at DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    inputs
  );

  res.json({
    success: true,
    data: result.recordset,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
};

// PATCH /api/admin/orders/:id/status
exports.updateOrderStatus = async (req, res, next) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'];
  if (!allowed.includes(status)) return next(new AppError('Trạng thái không hợp lệ', 400));

  const orderId = parseInt(req.params.id);

  // Lấy status cũ + user_id trước khi update
  const prevRes = await query('SELECT user_id, status AS prev_status FROM Orders WHERE id = @id',
    [{ name: 'id', type: sql.Int, value: orderId }]);
  const prev = prevRes.recordset[0];

  await query(
    'UPDATE Orders SET status = @status, updated_at = GETDATE() WHERE id = @id',
    [
      { name: 'status', type: sql.VarChar, value: status },
      { name: 'id',     type: sql.Int,     value: orderId },
    ]
  );

  // AI tracking khi chuyển sang confirmed lần đầu
  if (prev && status === 'confirmed' && prev.prev_status === 'pending') {
    setImmediate(async () => {
      try {
        const pool = getPool();
        const itemsRes = await query(
          'SELECT product_id FROM OrderItems WHERE order_id = @id AND product_id IS NOT NULL',
          [{ name: 'id', type: sql.Int, value: orderId }]
        );
        const productIds = itemsRes.recordset.map(r => r.product_id);
        await trackOrderPurchase(pool, prev.user_id, productIds);

        const cntRes = await query("SELECT COUNT(*) AS cnt FROM Orders WHERE status IN ('confirmed','completed')", []);
        if ((cntRes.recordset[0].cnt % 20) === 0) await triggerRetrain(AI_SERVICE_URL);
      } catch (e) { console.error('[Order] Status tracking error:', e.message); }
    });
  }

  res.json({ success: true, message: 'Cập nhật trạng thái thành công' });
};
