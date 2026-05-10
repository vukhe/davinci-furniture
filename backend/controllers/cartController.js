// ════════════════════════════════════════════════════════════
// cartController.js
// ════════════════════════════════════════════════════════════
const { query, sql } = require('../config/db');

const getOrCreateCart = async (userId) => {
  let res = await query('SELECT id FROM Carts WHERE user_id = @uid',
    [{ name: 'uid', type: sql.Int, value: userId }]);
  if (res.recordset.length) return res.recordset[0].id;
  res = await query('INSERT INTO Carts (user_id) OUTPUT INSERTED.id VALUES (@uid)',
    [{ name: 'uid', type: sql.Int, value: userId }]);
  return res.recordset[0].id;
};

const getCartItems = async (cartId) => {
  const res = await query(
    `SELECT ci.id, ci.product_id, ci.variant_id, ci.quantity, ci.price,
            p.name, p.stock,
            (SELECT TOP 1 url FROM ProductImages WHERE product_id = p.id AND is_primary = 1) AS image,
            pv.color, pv.size
     FROM CartItems ci
     JOIN Products p ON ci.product_id = p.id
     LEFT JOIN ProductVariants pv ON ci.variant_id = pv.id
     WHERE ci.cart_id = @cid`,
    [{ name: 'cid', type: sql.Int, value: cartId }]
  );
  return res.recordset;
};

exports.getCart = async (req, res) => {
  const cartId = await getOrCreateCart(req.user.id);
  const items  = await getCartItems(cartId);
  res.json({ success: true, data: items });
};

exports.addItem = async (req, res) => {
  const { product_id, variant_id, quantity = 1 } = req.body;
  const cartId = await getOrCreateCart(req.user.id);

  // Check if item already exists
  const existing = await query(
    'SELECT id, quantity FROM CartItems WHERE cart_id = @cid AND product_id = @pid AND (variant_id = @vid OR (variant_id IS NULL AND @vid IS NULL))',
    [
      { name: 'cid', type: sql.Int, value: cartId },
      { name: 'pid', type: sql.Int, value: product_id },
      { name: 'vid', type: sql.Int, value: variant_id || null },
    ]
  );

  const prodRes = await query('SELECT price, sale_price FROM Products WHERE id = @id',
    [{ name: 'id', type: sql.Int, value: product_id }]);
  const prod = prodRes.recordset[0];
  const price = prod.sale_price || prod.price;

  if (existing.recordset.length) {
    await query('UPDATE CartItems SET quantity = quantity + @qty WHERE id = @id',
      [
        { name: 'qty', type: sql.Int, value: quantity },
        { name: 'id',  type: sql.Int, value: existing.recordset[0].id },
      ]);
  } else {
    await query('INSERT INTO CartItems (cart_id, product_id, variant_id, quantity, price) VALUES (@cid, @pid, @vid, @qty, @price)',
      [
        { name: 'cid',   type: sql.Int,     value: cartId },
        { name: 'pid',   type: sql.Int,     value: product_id },
        { name: 'vid',   type: sql.Int,     value: variant_id || null },
        { name: 'qty',   type: sql.Int,     value: quantity },
        { name: 'price', type: sql.Decimal, value: price },
      ]);
  }

  const items = await getCartItems(cartId);
  res.json({ success: true, data: items });
};

exports.updateItem = async (req, res) => {
  const { quantity } = req.body;
  const cartId = await getOrCreateCart(req.user.id);
  await query('UPDATE CartItems SET quantity = @qty WHERE id = @id AND cart_id = @cid',
    [
      { name: 'qty', type: sql.Int, value: quantity },
      { name: 'id',  type: sql.Int, value: parseInt(req.params.itemId) },
      { name: 'cid', type: sql.Int, value: cartId },
    ]);
  const items = await getCartItems(cartId);
  res.json({ success: true, data: items });
};

exports.removeItem = async (req, res) => {
  const cartId = await getOrCreateCart(req.user.id);
  await query('DELETE FROM CartItems WHERE id = @id AND cart_id = @cid',
    [
      { name: 'id',  type: sql.Int, value: parseInt(req.params.itemId) },
      { name: 'cid', type: sql.Int, value: cartId },
    ]);
  res.json({ success: true });
};

exports.clearCart = async (req, res) => {
  const cartId = await getOrCreateCart(req.user.id);
  await query('DELETE FROM CartItems WHERE cart_id = @cid',
    [{ name: 'cid', type: sql.Int, value: cartId }]);
  res.json({ success: true });
};

module.exports = exports;
