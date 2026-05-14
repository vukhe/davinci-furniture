const { query, sql, getPool } = require('../config/db');
const { logInteraction } = require('../middleware/trackInteraction');
const { AppError } = require('../middleware/errorHandler');
const slugify = require('slugify');

const parseIdList = (value = '') =>
  Array.from(
    new Set(
      String(value)
        .split(',')
        .map((item) => parseInt(item.trim(), 10))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );

const tokenize = (text = '') =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const aiScoreProduct = (product, ctx) => {
  let score = 0;
  const name = (product.name || '').toLowerCase();
  const material = (product.material || '').toLowerCase();
  const category = (product.category_name || '').toLowerCase();
  const haystack = `${name} ${material} ${category}`;

  if (ctx.tokens.length) {
    for (const token of ctx.tokens) {
      if (name.includes(token)) score += 6;
      else if (haystack.includes(token)) score += 3;
    }
  }

  if (ctx.category && String(product.category_id) === String(ctx.category)) score += 4;
  if (ctx.material && material.includes(String(ctx.material).toLowerCase())) score += 3;

  const effectivePrice = Number(product.sale_price || product.price || 0);
  if (ctx.minPrice && effectivePrice >= Number(ctx.minPrice)) score += 1;
  if (ctx.maxPrice && effectivePrice <= Number(ctx.maxPrice)) score += 1;

  score += Math.log1p(Number(product.sold || 0)) * 0.7;
  score += Number(product.avg_rating || 0) * 0.8;
  if (product.is_featured) score += 1;

  return Number(score.toFixed(2));
};

// GET /api/products  (filter, search, pagination)
exports.getProducts = async (req, res) => {
  const {
    page = 1, limit = 24,
    ids,
    category, search,
    minPrice, maxPrice,
    color, material,
    sort = 'created_at', order = 'DESC',
    featured,
    ai = 'false',
  } = req.query;

  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 800);
  const offset = (currentPage - 1) * pageSize;
  const conditions = ['p.is_active = 1'];
  const inputs = [];
  const idList = parseIdList(ids);

  if (idList.length > 0) {
    const idInputs = idList.map((value, index) => ({
      name: `id${index}`,
      type: sql.Int,
      value,
    }));
    const placeholders = idInputs.map((item) => `@${item.name}`).join(', ');

    const result = await query(
      `SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.stock, p.sold,
              p.material, p.is_featured, p.category_id,
              cat.name AS category_name,
              (SELECT TOP 1 url FROM ProductImages WHERE product_id = p.id AND is_primary = 1) AS image,
              (SELECT AVG(CAST(rating AS FLOAT)) FROM Reviews WHERE product_id = p.id) AS avg_rating,
              (SELECT COUNT(*) FROM Reviews WHERE product_id = p.id) AS review_count
       FROM Products p
       LEFT JOIN Categories cat ON p.category_id = cat.id
       WHERE p.is_active = 1 AND p.id IN (${placeholders})`,
      idInputs
    );

    const ordered = idList
      .map((id) => result.recordset.find((item) => item.id === id))
      .filter(Boolean);
    const paged = ordered.slice(offset, offset + pageSize);

    return res.json({
      success: true,
      data: paged,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total: ordered.length,
        pages: Math.ceil(ordered.length / pageSize) || 1,
      },
      meta: { orderedByIds: true },
    });
  }

  if (category) {
    conditions.push('(p.category_id = @catId OR c.parent_id = @catId)');
    inputs.push({ name: 'catId', type: sql.Int, value: parseInt(category) });
  }
  if (search) {
    conditions.push('p.name LIKE @search');
    inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
  }
  if (minPrice) {
    conditions.push('COALESCE(p.sale_price, p.price) >= @minPrice');
    inputs.push({ name: 'minPrice', type: sql.Decimal, value: parseFloat(minPrice) });
  }
  if (maxPrice) {
    conditions.push('COALESCE(p.sale_price, p.price) <= @maxPrice');
    inputs.push({ name: 'maxPrice', type: sql.Decimal, value: parseFloat(maxPrice) });
  }
  if (material) {
    conditions.push('p.material = @material');
    inputs.push({ name: 'material', type: sql.NVarChar, value: material });
  }
  if (featured === 'true') {
    conditions.push('p.is_featured = 1');
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const allowedSort = ['created_at', 'price', 'sold', 'name'];
  const sortCol = allowedSort.includes(sort) ? sort : 'created_at';
  const sortDir = order === 'ASC' ? 'ASC' : 'DESC';

  if (ai === 'true') {
    const aiResult = await query(
      `SELECT TOP 300 p.id, p.name, p.slug, p.price, p.sale_price, p.stock, p.sold,
              p.material, p.is_featured, p.category_id,
              cat.name AS category_name,
              (SELECT TOP 1 url FROM ProductImages WHERE product_id = p.id AND is_primary = 1) AS image,
              (SELECT AVG(CAST(rating AS FLOAT)) FROM Reviews WHERE product_id = p.id) AS avg_rating,
              (SELECT COUNT(*) FROM Reviews WHERE product_id = p.id) AS review_count
       FROM Products p
       LEFT JOIN Categories cat ON p.category_id = cat.id
       LEFT JOIN Categories c   ON p.category_id = c.id
       ${whereClause}
       ORDER BY p.sold DESC, p.created_at DESC`,
      inputs
    );

    const tokens = tokenize(search);
    const scored = aiResult.recordset
      .map((p) => ({ ...p, ai_score: aiScoreProduct(p, { tokens, category, material, minPrice, maxPrice }) }))
      .sort((a, b) => b.ai_score - a.ai_score);

    const total = scored.length;
    const paged = scored.slice(offset, offset + pageSize);

    return res.json({
      success: true,
      data: paged,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
      meta: { aiRanked: true, queryTokens: tokens },
    });
  }

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM Products p
     LEFT JOIN Categories c ON p.category_id = c.id
     ${whereClause}`,
    inputs
  );
  const total = countResult.recordset[0].total;

  const listInputs = [
    ...inputs,
    { name: 'offset', type: sql.Int, value: offset },
    { name: 'limit', type: sql.Int, value: pageSize },
  ];

  const result = await query(
    `SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.stock, p.sold,
            p.material, p.is_featured, p.category_id,
            cat.name AS category_name,
            (SELECT TOP 1 url FROM ProductImages WHERE product_id = p.id AND is_primary = 1) AS image,
            (SELECT AVG(CAST(rating AS FLOAT)) FROM Reviews WHERE product_id = p.id) AS avg_rating,
            (SELECT COUNT(*) FROM Reviews WHERE product_id = p.id) AS review_count
     FROM Products p
     LEFT JOIN Categories cat ON p.category_id = cat.id
     LEFT JOIN Categories c   ON p.category_id = c.id
     ${whereClause}
     ORDER BY p.${sortCol} ${sortDir}
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    listInputs
  );

  return res.json({
    success: true,
    data: result.recordset,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      pages: Math.ceil(total / pageSize),
    },
    meta: { aiRanked: false },
  });
};

// GET /api/products/:slug
exports.getProductBySlug = async (req, res, next) => {
  // Fire-and-forget view tracking
  const result = await query(
    `SELECT p.*, cat.name AS category_name, cat.id AS category_id
     FROM Products p
     LEFT JOIN Categories cat ON p.category_id = cat.id
     WHERE (p.slug = @slug OR CAST(p.id AS VARCHAR(50)) = @slug) AND p.is_active = 1`,
    [{ name: 'slug', type: sql.VarChar, value: req.params.slug }]
  );

  const product = result.recordset[0];
  if (!product) return next(new AppError('Sản phẩm không tồn tại', 404));

  if (req.user?.id) {
    setImmediate(async () => {
      try {
        await logInteraction(getPool(), req.user.id, product.id, 'view');
      } catch (e) {
        console.error('[Product] View tracking error:', e.message);
      }
    });
  }

  const [images, variants, reviews] = await Promise.all([
    query('SELECT * FROM ProductImages WHERE product_id = @id ORDER BY sort_order',
      [{ name: 'id', type: sql.Int, value: product.id }]),
    query('SELECT * FROM ProductVariants WHERE product_id = @id',
      [{ name: 'id', type: sql.Int, value: product.id }]),
    query(
      `SELECT r.*, u.name AS user_name, u.avatar FROM Reviews r
       JOIN Users u ON r.user_id = u.id
       WHERE r.product_id = @id ORDER BY r.created_at DESC`,
      [{ name: 'id', type: sql.Int, value: product.id }]
    ),
  ]);

  // Related products
  const related = await query(
    `SELECT TOP 4 p.id, p.name, p.slug, p.price, p.sale_price,
            (SELECT TOP 1 url FROM ProductImages WHERE product_id = p.id AND is_primary = 1) AS image
     FROM Products p
     WHERE p.category_id = @catId AND p.id != @id AND p.is_active = 1
     ORDER BY NEWID()`,
    [
      { name: 'catId', type: sql.Int, value: product.category_id },
      { name: 'id',    type: sql.Int, value: product.id },
    ]
  );

  res.json({
    success: true,
    data: {
      ...product,
      images: images.recordset,
      variants: variants.recordset,
      reviews: reviews.recordset,
      related: related.recordset,
    },
  });
};

// POST /api/admin/products
exports.createProduct = async (req, res, next) => {
  const {
    name, category_id, description, brand, material,
    width_cm, depth_cm, height_cm,
    price, sale_price, stock, is_featured,
    images = [], variants = [],
  } = req.body;

  const slug = slugify(name, { lower: true, strict: true, locale: 'vi' });

  const result = await query(
    `INSERT INTO Products (name, slug, category_id, description, brand, material,
                           width_cm, depth_cm, height_cm, price, sale_price, stock, is_featured)
     OUTPUT INSERTED.id
     VALUES (@name, @slug, @cat, @desc, @brand, @mat, @w, @d, @h, @price, @salePrice, @stock, @featured)`,
    [
      { name: 'name',      type: sql.NVarChar, value: name },
      { name: 'slug',      type: sql.VarChar,  value: slug },
      { name: 'cat',       type: sql.Int,      value: parseInt(category_id) },
      { name: 'desc',      type: sql.NVarChar, value: description || null },
      { name: 'brand',     type: sql.NVarChar, value: brand || null },
      { name: 'mat',       type: sql.NVarChar, value: material || null },
      { name: 'w',         type: sql.Decimal,  value: width_cm  ? parseFloat(width_cm)  : null },
      { name: 'd',         type: sql.Decimal,  value: depth_cm  ? parseFloat(depth_cm)  : null },
      { name: 'h',         type: sql.Decimal,  value: height_cm ? parseFloat(height_cm) : null },
      { name: 'price',     type: sql.Decimal,  value: parseFloat(price) },
      { name: 'salePrice', type: sql.Decimal,  value: sale_price ? parseFloat(sale_price) : null },
      { name: 'stock',     type: sql.Int,      value: parseInt(stock) || 0 },
      { name: 'featured',  type: sql.Bit,      value: is_featured ? 1 : 0 },
    ]
  );

  const productId = result.recordset[0].id;

  // Insert images
  for (let i = 0; i < images.length; i++) {
    await query(
      `INSERT INTO ProductImages (product_id, url, public_id, is_primary, sort_order)
       VALUES (@pid, @url, @pubId, @primary, @sort)`,
      [
        { name: 'pid',     type: sql.Int,     value: productId },
        { name: 'url',     type: sql.VarChar, value: images[i].url },
        { name: 'pubId',   type: sql.VarChar, value: images[i].public_id || null },
        { name: 'primary', type: sql.Bit,     value: i === 0 ? 1 : 0 },
        { name: 'sort',    type: sql.Int,     value: i },
      ]
    );
  }

  // Insert variants
  for (const v of variants) {
    await query(
      `INSERT INTO ProductVariants (product_id, color, size, price, stock, sku)
       VALUES (@pid, @color, @size, @price, @stock, @sku)`,
      [
        { name: 'pid',   type: sql.Int,      value: productId },
        { name: 'color', type: sql.NVarChar, value: v.color || null },
        { name: 'size',  type: sql.NVarChar, value: v.size || null },
        { name: 'price', type: sql.Decimal,  value: v.price ? parseFloat(v.price) : null },
        { name: 'stock', type: sql.Int,      value: parseInt(v.stock) || 0 },
        { name: 'sku',   type: sql.VarChar,  value: v.sku || null },
      ]
    );
  }

  res.status(201).json({ success: true, message: 'Tạo sản phẩm thành công', productId });
};

// PUT /api/admin/products/:id
exports.updateProduct = async (req, res, next) => {
  const { id } = req.params;
  const {
    name, category_id, description, brand, material,
    width_cm, depth_cm, height_cm,
    price, sale_price, stock, is_featured, is_active,
  } = req.body;

  const slug = name ? slugify(name, { lower: true, strict: true, locale: 'vi' }) : undefined;

  await query(
    `UPDATE Products SET
       name        = COALESCE(@name, name),
       slug        = COALESCE(@slug, slug),
       category_id = COALESCE(@cat, category_id),
       description = COALESCE(@desc, description),
       brand       = COALESCE(@brand, brand),
       material    = COALESCE(@mat, material),
       width_cm    = COALESCE(@w, width_cm),
       depth_cm    = COALESCE(@d, depth_cm),
       height_cm   = COALESCE(@h, height_cm),
       price       = COALESCE(@price, price),
       sale_price  = @salePrice,
       stock       = COALESCE(@stock, stock),
       is_featured = COALESCE(@featured, is_featured),
       is_active   = COALESCE(@active, is_active),
       updated_at  = GETDATE()
     WHERE id = @id`,
    [
      { name: 'name',      type: sql.NVarChar, value: name || null },
      { name: 'slug',      type: sql.VarChar,  value: slug || null },
      { name: 'cat',       type: sql.Int,      value: category_id ? parseInt(category_id) : null },
      { name: 'desc',      type: sql.NVarChar, value: description !== undefined ? description : null },
      { name: 'brand',     type: sql.NVarChar, value: brand || null },
      { name: 'mat',       type: sql.NVarChar, value: material || null },
      { name: 'w',         type: sql.Decimal,  value: width_cm  ? parseFloat(width_cm)  : null },
      { name: 'd',         type: sql.Decimal,  value: depth_cm  ? parseFloat(depth_cm)  : null },
      { name: 'h',         type: sql.Decimal,  value: height_cm ? parseFloat(height_cm) : null },
      { name: 'price',     type: sql.Decimal,  value: price ? parseFloat(price) : null },
      { name: 'salePrice', type: sql.Decimal,  value: sale_price !== undefined ? (sale_price ? parseFloat(sale_price) : null) : null },
      { name: 'stock',     type: sql.Int,      value: stock !== undefined ? parseInt(stock) : null },
      { name: 'featured',  type: sql.Bit,      value: is_featured !== undefined ? (is_featured ? 1 : 0) : null },
      { name: 'active',    type: sql.Bit,      value: is_active !== undefined ? (is_active ? 1 : 0) : null },
      { name: 'id',        type: sql.Int,      value: parseInt(id) },
    ]
  );

  res.json({ success: true, message: 'Cập nhật sản phẩm thành công' });
};

// DELETE /api/admin/products/:id
exports.deleteProduct = async (req, res) => {
  await query(
    'UPDATE Products SET is_active = 0 WHERE id = @id',
    [{ name: 'id', type: sql.Int, value: parseInt(req.params.id) }]
  );
  res.json({ success: true, message: 'Xóa sản phẩm thành công' });
};
