const { query, sql } = require('../config/db');
const { AppError }   = require('../middleware/errorHandler');
const { delPattern } = require('../config/redis');
const slugify        = require('slugify');

// GET /api/collections
exports.getCollections = async (req, res) => {
  const result = await query(
    `SELECT c.id, c.name, c.slug, c.description, c.banner_image, c.sort_order,
            COUNT(cp.product_id) AS product_count
     FROM Collections c
     LEFT JOIN CollectionProducts cp ON cp.collection_id = c.id
     WHERE c.is_active = 1
     GROUP BY c.id, c.name, c.slug, c.description, c.banner_image, c.sort_order
     ORDER BY c.sort_order, c.name`
  );
  res.json({ success: true, data: result.recordset });
};

// GET /api/collections/:slug
exports.getCollectionBySlug = async (req, res, next) => {
  const { page = 1, limit = 12 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const colRes = await query(
    'SELECT * FROM Collections WHERE slug = @slug AND is_active = 1',
    [{ name: 'slug', type: sql.VarChar, value: req.params.slug }]
  );
  const collection = colRes.recordset[0];
  if (!collection) return next(new AppError('Bộ sưu tập không tồn tại', 404));

  const countRes = await query(
    `SELECT COUNT(*) AS total FROM CollectionProducts cp
     JOIN Products p ON cp.product_id = p.id
     WHERE cp.collection_id = @cid AND p.is_active = 1`,
    [{ name: 'cid', type: sql.Int, value: collection.id }]
  );

  const products = await query(
    `SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.stock, p.sold,
            cat.name AS category_name,
            img.url  AS image,
            rv.avg_rating, rv.review_count
     FROM CollectionProducts cp
     JOIN Products p ON cp.product_id = p.id
     JOIN Categories cat ON p.category_id = cat.id
     OUTER APPLY (
       SELECT TOP 1 url FROM ProductImages WHERE product_id = p.id AND is_primary = 1
     ) img
     OUTER APPLY (
       SELECT AVG(CAST(rating AS FLOAT)) AS avg_rating, COUNT(*) AS review_count
       FROM Reviews WHERE product_id = p.id
     ) rv
     WHERE cp.collection_id = @cid AND p.is_active = 1
     ORDER BY cp.sort_order, p.sold DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    [
      { name: 'cid',    type: sql.Int, value: collection.id },
      { name: 'offset', type: sql.Int, value: offset },
      { name: 'limit',  type: sql.Int, value: parseInt(limit) },
    ]
  );

  res.json({
    success: true,
    data: {
      collection,
      products: products.recordset,
      pagination: {
        page: parseInt(page), limit: parseInt(limit),
        total: countRes.recordset[0].total,
        pages: Math.ceil(countRes.recordset[0].total / parseInt(limit)),
      },
    },
  });
};

// POST /api/admin/collections
exports.createCollection = async (req, res) => {
  const { name, description, banner_image, sort_order = 0 } = req.body;
  if (!name?.trim()) {
    throw new AppError('Tên bộ sưu tập không được trống', 400);
  }
  const slug = slugify(name, { lower: true, strict: true, locale: 'vi' });
  await query(
    `INSERT INTO Collections (name, slug, description, banner_image, sort_order)
     VALUES (@name, @slug, @desc, @img, @sort)`,
    [
      { name: 'name', type: sql.NVarChar, value: name.trim() },
      { name: 'slug', type: sql.VarChar,  value: slug },
      { name: 'desc', type: sql.NVarChar, value: description || null },
      { name: 'img',  type: sql.VarChar,  value: banner_image || null },
      { name: 'sort', type: sql.Int,      value: parseInt(sort_order) || 0 },
    ]
  );
  await delPattern('cache:*col:*');
  res.status(201).json({ success: true, message: 'Tạo bộ sưu tập thành công' });
};

// POST /api/admin/collections/:id/products
exports.addProduct = async (req, res) => {
  const { product_id, sort_order = 0 } = req.body;
  await query(
    `IF NOT EXISTS (SELECT 1 FROM CollectionProducts WHERE collection_id=@cid AND product_id=@pid)
     INSERT INTO CollectionProducts (collection_id, product_id, sort_order) VALUES (@cid, @pid, @sort)`,
    [
      { name: 'cid',  type: sql.Int, value: parseInt(req.params.id) },
      { name: 'pid',  type: sql.Int, value: parseInt(product_id) },
      { name: 'sort', type: sql.Int, value: parseInt(sort_order) || 0 },
    ]
  );
  await delPattern('cache:*col:*');
  res.json({ success: true, message: 'Đã thêm sản phẩm vào bộ sưu tập' });
};

// DELETE /api/admin/collections/:id/products/:productId
exports.removeProduct = async (req, res) => {
  await query(
    'DELETE FROM CollectionProducts WHERE collection_id=@cid AND product_id=@pid',
    [
      { name: 'cid', type: sql.Int, value: parseInt(req.params.id) },
      { name: 'pid', type: sql.Int, value: parseInt(req.params.productId) },
    ]
  );
  await delPattern('cache:*col:*');
  res.json({ success: true, message: 'Đã xóa sản phẩm khỏi bộ sưu tập' });
};

// DELETE /api/admin/collections/:id
exports.deleteCollection = async (req, res) => {
  await query(
    'UPDATE Collections SET is_active = 0 WHERE id = @id',
    [{ name: 'id', type: sql.Int, value: parseInt(req.params.id) }]
  );
  await delPattern('cache:*col:*');
  res.json({ success: true, message: 'Đã xóa bộ sưu tập' });
};
