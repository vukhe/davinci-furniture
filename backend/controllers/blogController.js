const { query, sql } = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const slugify = require('slugify');

exports.getPosts = async (req, res) => {
  const { page = 1, limit = 9, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const inputs = [];
  let where = 'WHERE b.is_published = 1';

  if (search) {
    where += ' AND b.title LIKE @search';
    inputs.push({ name: 'search', type: sql.NVarChar, value: `%${search}%` });
  }

  inputs.push(
    { name: 'offset', type: sql.Int, value: offset },
    { name: 'limit',  type: sql.Int, value: parseInt(limit) }
  );

  const result = await query(
    `SELECT b.id, b.title, b.slug, b.excerpt, b.thumbnail, b.views, b.created_at,
            u.name AS author_name
     FROM BlogPosts b
     JOIN Users u ON b.author_id = u.id
     ${where}
     ORDER BY b.created_at DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    inputs
  );

  res.json({ success: true, data: result.recordset });
};

exports.getPostBySlug = async (req, res, next) => {
  const result = await query(
    `SELECT b.*, u.name AS author_name
     FROM BlogPosts b
     JOIN Users u ON b.author_id = u.id
     WHERE b.slug = @slug AND b.is_published = 1`,
    [{ name: 'slug', type: sql.VarChar, value: req.params.slug }]
  );

  if (!result.recordset[0]) return next(new AppError('Bài viết không tồn tại', 404));

  await query(
    'UPDATE BlogPosts SET views = views + 1 WHERE slug = @slug',
    [{ name: 'slug', type: sql.VarChar, value: req.params.slug }]
  );

  res.json({ success: true, data: result.recordset[0] });
};

exports.createPost = async (req, res) => {
  const { title, content, excerpt, thumbnail, is_published } = req.body;
  const slug = slugify(title, { lower: true, strict: true, locale: 'vi' });

  await query(
    `INSERT INTO BlogPosts (title, slug, content, excerpt, thumbnail, author_id, is_published)
     VALUES (@t, @s, @c, @e, @th, @a, @pub)`,
    [
      { name: 't',   type: sql.NVarChar, value: title },
      { name: 's',   type: sql.VarChar,  value: slug },
      { name: 'c',   type: sql.NVarChar, value: content },
      { name: 'e',   type: sql.NVarChar, value: excerpt || null },
      { name: 'th',  type: sql.VarChar,  value: thumbnail || null },
      { name: 'a',   type: sql.Int,      value: req.user.id },
      { name: 'pub', type: sql.Bit,      value: is_published ? 1 : 0 },
    ]
  );

  res.status(201).json({ success: true, message: 'Tạo bài viết thành công' });
};

exports.updatePost = async (req, res) => {
  const { title, content, excerpt, thumbnail, is_published } = req.body;

  await query(
    `UPDATE BlogPosts
     SET title = @t, content = @c, excerpt = @e, thumbnail = @th,
         is_published = @pub, updated_at = GETDATE()
     WHERE id = @id`,
    [
      { name: 't',   type: sql.NVarChar, value: title },
      { name: 'c',   type: sql.NVarChar, value: content },
      { name: 'e',   type: sql.NVarChar, value: excerpt || null },
      { name: 'th',  type: sql.VarChar,  value: thumbnail || null },
      { name: 'pub', type: sql.Bit,      value: is_published ? 1 : 0 },
      { name: 'id',  type: sql.Int,      value: parseInt(req.params.id) },
    ]
  );

  res.json({ success: true, message: 'Cập nhật thành công' });
};

exports.deletePost = async (req, res) => {
  await query(
    'DELETE FROM BlogPosts WHERE id = @id',
    [{ name: 'id', type: sql.Int, value: parseInt(req.params.id) }]
  );
  res.json({ success: true });
};
