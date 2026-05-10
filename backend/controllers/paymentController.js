const crypto      = require('crypto');
const querystring = require('querystring');
const axios       = require('axios');
const { query, sql } = require('../config/db');

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Xóa toàn bộ CartItems của user sau thanh toán thành công */
const clearUserCart = async (userId) => {
  try {
    const cartRes = await query(
      'SELECT id FROM Carts WHERE user_id = @uid',
      [{ name: 'uid', type: sql.Int, value: userId }]
    );
    if (!cartRes.recordset.length) return;
    await query(
      'DELETE FROM CartItems WHERE cart_id = @cid',
      [{ name: 'cid', type: sql.Int, value: cartRes.recordset[0].id }]
    );
  } catch (_) { /* non-critical */ }
};

/** Ghi UserInteractions 'purchase' cho từng sản phẩm trong đơn */
const recordPurchaseInteractions = async (orderId, userId) => {
  try {
    const items = await query(
      'SELECT product_id FROM OrderItems WHERE order_id = @oid AND product_id IS NOT NULL',
      [{ name: 'oid', type: sql.Int, value: orderId }]
    );
    for (const item of items.recordset) {
      await query(
        `IF EXISTS (SELECT 1 FROM UserInteractions
                    WHERE user_id=@uid AND product_id=@pid AND type='purchase')
           UPDATE UserInteractions SET score=score+5, created_at=GETDATE()
            WHERE user_id=@uid AND product_id=@pid AND type='purchase'
         ELSE
           INSERT INTO UserInteractions (user_id,product_id,type,score)
           VALUES (@uid,@pid,'purchase',5)`,
        [
          { name: 'uid', type: sql.Int, value: userId },
          { name: 'pid', type: sql.Int, value: item.product_id },
        ]
      );
    }
  } catch (_) { /* non-critical */ }
};

/** Lấy meta đơn hàng từ order_code */
const getOrderMeta = async (orderCode) => {
  const res = await query(
    'SELECT id, user_id FROM Orders WHERE order_code = @code',
    [{ name: 'code', type: sql.VarChar, value: orderCode }]
  );
  return res.recordset[0] || null;
};

// ─── VNPay ────────────────────────────────────────────────────────────────────

exports.createVnpayUrl = async (req, res) => {
  const { order_code, amount } = req.body;

  const date   = new Date();
  const pad    = (n) => String(n).padStart(2, '0');
  const createDate = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');

  const params = {
    vnp_Version:    '2.1.0',
    vnp_Command:    'pay',
    vnp_TmnCode:    process.env.VNPAY_TMNCODE,
    vnp_Amount:     Math.round(amount) * 100,
    vnp_CreateDate: createDate,
    vnp_CurrCode:   'VND',
    vnp_IpAddr:     req.headers['x-forwarded-for'] || req.ip || '127.0.0.1',
    vnp_Locale:     'vn',
    vnp_OrderInfo:  `Thanh toan don hang ${order_code}`,
    vnp_OrderType:  'other',
    vnp_ReturnUrl:  process.env.VNPAY_RETURN_URL,
    vnp_TxnRef:     order_code,
  };

  const sorted   = Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
  const signData = querystring.stringify(sorted);
  const hmac     = crypto.createHmac('sha512', process.env.VNPAY_HASHSECRET);
  const signed   = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  const paymentUrl = `${process.env.VNPAY_URL}?${querystring.stringify({ ...sorted, vnp_SecureHash: signed })}`;

  res.json({ success: true, data: { payment_url: paymentUrl } });
};

exports.vnpayReturn = async (req, res) => {
  const { vnp_ResponseCode, vnp_TxnRef, vnp_SecureHash, ...rest } = req.query;

  // Verify chữ ký
  const sorted   = Object.fromEntries(Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)));
  const signData = querystring.stringify(sorted);
  const hmac     = crypto.createHmac('sha512', process.env.VNPAY_HASHSECRET);
  const signed   = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  if (signed !== vnp_SecureHash) {
    return res.redirect(`${process.env.CLIENT_URL}/orders?vnpay=invalid`);
  }

  if (vnp_ResponseCode === '00') {
    // 1. Cập nhật trạng thái đơn
    await query(
      `UPDATE Orders SET payment_status='paid', status='confirmed', updated_at=GETDATE()
       WHERE order_code=@code`,
      [{ name: 'code', type: sql.VarChar, value: vnp_TxnRef }]
    ).catch(() => {});

    // 2. Lấy meta đơn hàng
    const order = await getOrderMeta(vnp_TxnRef);

    if (order) {
      // 3. Xóa giỏ hàng
      await clearUserCart(order.user_id);

      // 4. Ghi interaction 'purchase' cho AI recommender
      await recordPurchaseInteractions(order.id, order.user_id);
    }

    return res.redirect(`${process.env.CLIENT_URL}/orders/${order?.id}?success=1&payment=vnpay`);
  }

  res.redirect(`${process.env.CLIENT_URL}/orders?vnpay=${vnp_ResponseCode}&ref=${vnp_TxnRef}`);
};

// ─── MoMo ─────────────────────────────────────────────────────────────────────

exports.createMomoUrl = async (req, res, next) => {
  try {
    const { order_code, amount } = req.body;

    const partnerCode = process.env.MOMO_PARTNER_CODE;
    const accessKey   = process.env.MOMO_ACCESS_KEY;
    const secretKey   = process.env.MOMO_SECRET_KEY;
    const returnUrl   = process.env.MOMO_RETURN_URL;
    const notifyUrl   = process.env.MOMO_NOTIFY_URL;
    const requestId   = `${order_code}_${Date.now()}`;
    const orderInfo   = `Thanh toan don hang ${order_code}`;
    const redirectUrl = returnUrl;
    const ipnUrl      = notifyUrl;
    const requestType = 'payWithMethod';
    const extraData   = '';
    const autoCapture = true;
    const lang        = 'vi';

    const rawSignature =
      `accessKey=${accessKey}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${ipnUrl}` +
      `&orderId=${order_code}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${partnerCode}` +
      `&redirectUrl=${redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=${requestType}`;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const payload = {
      partnerCode, accessKey, requestId,
      amount: String(amount),
      orderId: order_code,
      orderInfo, redirectUrl, ipnUrl,
      requestType, signature, lang, autoCapture,
      extraData,
    };

    const momoRes = await axios.post(
      'https://test-payment.momo.vn/v2/gateway/api/create',
      payload,
      { timeout: 10000 }
    );

    if (momoRes.data.resultCode !== 0) {
      return res.status(400).json({ success: false, message: momoRes.data.message });
    }

    res.json({ success: true, data: { payment_url: momoRes.data.payUrl } });
  } catch (err) {
    next(err);
  }
};

/** IPN callback từ MoMo server (server-to-server) */
exports.momoNotify = async (req, res) => {
  const {
    partnerCode, orderId, requestId, amount,
    orderInfo, orderType, transId,
    resultCode, message, payType, responseTime,
    extraData, signature,
  } = req.body;

  // Xác minh chữ ký
  const rawSignature =
    `accessKey=${process.env.MOMO_ACCESS_KEY}` +
    `&amount=${amount}` +
    `&extraData=${extraData}` +
    `&message=${message}` +
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&orderType=${orderType}` +
    `&partnerCode=${partnerCode}` +
    `&payType=${payType}` +
    `&requestId=${requestId}` +
    `&responseTime=${responseTime}` +
    `&resultCode=${resultCode}` +
    `&transId=${transId}`;

  const expected = crypto
    .createHmac('sha256', process.env.MOMO_SECRET_KEY)
    .update(rawSignature)
    .digest('hex');

  if (expected !== signature) {
    return res.status(400).json({ message: 'Invalid signature' });
  }

  if (resultCode === 0) {
    await query(
      `UPDATE Orders SET payment_status='paid', status='confirmed', updated_at=GETDATE()
       WHERE order_code=@code`,
      [{ name: 'code', type: sql.VarChar, value: orderId }]
    ).catch(() => {});

    const order = await getOrderMeta(orderId);
    if (order) {
      await clearUserCart(order.user_id);
      await recordPurchaseInteractions(order.id, order.user_id);
    }
  }

  // MoMo yêu cầu response 204
  res.status(204).end();
};

/** Redirect callback cho user sau khi MoMo xử lý */
exports.momoReturn = async (req, res) => {
  const { resultCode, orderId } = req.query;
  if (resultCode === '0') {
    const order = await getOrderMeta(orderId);
    return res.redirect(`${process.env.CLIENT_URL}/orders/${order?.id}?success=1&payment=momo`);
  }
  res.redirect(`${process.env.CLIENT_URL}/orders?momo=${resultCode}&ref=${orderId}`);
};
