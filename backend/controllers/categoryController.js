const { query, sql } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

exports.getCategories = async (req, res) => {
  const result = await query(
    `SELECT c.id, c.name, c.slug, c.parent_id, c.image, c.sort_order, c.is_active, c.created_at,
            COUNT(p.id) AS product_count
     FROM Categories c
     LEFT JOIN Products p ON p.category_id = c.id AND p.is_active = 1
     WHERE c.is_active = 1
     GROUP BY c.id, c.name, c.slug, c.parent_id, c.image, c.sort_order, c.is_active, c.created_at
     ORDER BY c.sort_order, c.name`
  );
  res.json({ success: true, data: result.recordset });
};

exports.getCategoryBySlug = async (req, res, next) => {
  const result = await query(
    'SELECT * FROM Categories WHERE slug = @slug',
    [{ name: 'slug', type: sql.VarChar, value: req.params.slug }]
  );
  if (!result.recordset[0]) return next(new AppError('Danh mục không tồn tại', 404));
  res.json({ success: true, data: result.recordset[0] });
};
