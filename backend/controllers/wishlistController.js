const { query, sql, getPool } = require('../config/db');
const { trackWishlist } = require('../middleware/trackInteraction');

exports.getWishlist = async (req, res) => {
  const result = await query(
    `SELECT w.product_id, p.name, p.slug, p.price, p.sale_price,
            (SELECT TOP 1 url FROM ProductImages WHERE product_id = p.id AND is_primary = 1) AS image
     FROM Wishlists w
     JOIN Products p ON w.product_id = p.id
     WHERE w.user_id = @uid
     ORDER BY w.added_at DESC`,
    [{ name: 'uid', type: sql.Int, value: req.user.id }]
  );
  res.json({ success: true, data: result.recordset });
};

exports.toggleWishlist = async (req, res) => {
  const productId = parseInt(req.params.productId);
  const inputs = [
    { name: 'uid', type: sql.Int, value: req.user.id },
    { name: 'pid', type: sql.Int, value: productId },
  ];

  const existing = await query(
    'SELECT 1 FROM Wishlists WHERE user_id = @uid AND product_id = @pid',
    inputs
  );

  if (existing.recordset.length) {
    await query('DELETE FROM Wishlists WHERE user_id = @uid AND product_id = @pid', inputs);
    return res.json({ success: true, added: false });
  }

  await query('INSERT INTO Wishlists (user_id, product_id) VALUES (@uid, @pid)', inputs);

  // AI tracking (fire-and-forget)
  setImmediate(async () => {
    try {
      const pool = getPool();
      await trackWishlist(pool, req.user.id, productId);
    } catch (e) { console.error('[Wishlist] Track error:', e.message); }
  });

  res.json({ success: true, added: true });
};
