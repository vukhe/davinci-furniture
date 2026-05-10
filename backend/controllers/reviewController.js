const { query, sql, getPool } = require('../config/db');
const { trackRating } = require('../middleware/trackInteraction');

exports.addReview = async (req, res) => {
  const { rating, comment } = req.body;
  const productId = parseInt(req.params.productId);

  const existing = await query(
    'SELECT id FROM Reviews WHERE user_id = @uid AND product_id = @pid',
    [
      { name: 'uid', type: sql.Int, value: req.user.id },
      { name: 'pid', type: sql.Int, value: productId },
    ]
  );

  if (existing.recordset.length) {
    await query(
      'UPDATE Reviews SET rating = @r, comment = @c WHERE id = @id',
      [
        { name: 'r', type: sql.TinyInt, value: parseInt(rating) },
        { name: 'c', type: sql.NVarChar, value: comment },
        { name: 'id', type: sql.Int, value: existing.recordset[0].id },
      ]
    );
  } else {
    await query(
      'INSERT INTO Reviews (product_id, user_id, rating, comment) VALUES (@pid, @uid, @r, @c)',
      [
        { name: 'pid', type: sql.Int, value: productId },
        { name: 'uid', type: sql.Int, value: req.user.id },
        { name: 'r', type: sql.TinyInt, value: parseInt(rating) },
        { name: 'c', type: sql.NVarChar, value: comment },
      ]
    );
  }

  setImmediate(async () => {
    try {
      await trackRating(getPool(), req.user.id, productId);
    } catch (e) {
      console.error('[Review] Track error:', e.message);
    }
  });

  res.json({ success: true, message: 'Cảm ơn bạn đã đánh giá!' });
};
