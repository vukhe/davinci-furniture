/**
 * Optimized SQL Server queries – rewrite các query nặng
 * Dùng thay thế từng phần trong controllers
 */
const { query, sql } = require('./db');

// ── Products: getProducts với covering index ──────────
exports.getProductsOptimized = async ({
  page = 1, limit = 12,
  category, search, minPrice, maxPrice,
  sort = 'created_at', order = 'DESC', featured,
}) => {
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const inputs = [];
  const conds  = ['p.is_active = 1'];

  if (category) { conds.push('p.category_id = @catId'); inputs.push({ name: 'catId', type: sql.Int, value: +category }); }
  if (search)   { conds.push('p.name LIKE @q');         inputs.push({ name: 'q', type: sql.NVarChar, value: `%${search}%` }); }
  if (minPrice) { conds.push('COALESCE(p.sale_price, p.price) >= @lo'); inputs.push({ name: 'lo', type: sql.Decimal, value: +minPrice }); }
  if (maxPrice) { conds.push('COALESCE(p.sale_price, p.price) <= @hi'); inputs.push({ name: 'hi', type: sql.Decimal, value: +maxPrice }); }
  if (featured === 'true') conds.push('p.is_featured = 1');

  const where    = `WHERE ${conds.join(' AND ')}`;
  const allowSort = { created_at: 'p.created_at', price: 'COALESCE(p.sale_price,p.price)', sold: 'p.sold', name: 'p.name' };
  const sortCol  = allowSort[sort] || 'p.created_at';
  const sortDir  = order === 'ASC' ? 'ASC' : 'DESC';

  // Count query – dùng riêng để tránh scan toàn bảng
  const countInputs = [...inputs];
  const countResult = await query(
    `SELECT COUNT(1) AS total FROM Products p ${where}`,
    countInputs
  );
  const total = countResult.recordset[0].total;

  inputs.push(
    { name: 'offset', type: sql.Int, value: offset },
    { name: 'limit',  type: sql.Int, value: +limit }
  );

  // Main query – chỉ lấy đúng cột cần (không SELECT *)
  const result = await query(
    `SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.stock, p.sold,
            p.material, p.is_featured, p.created_at,
            cat.name AS category_name,
            img.url  AS image,
            rv.avg_rating, rv.review_count
     FROM Products p
     JOIN Categories cat ON p.category_id = cat.id
     OUTER APPLY (
       SELECT TOP 1 url FROM ProductImages
       WHERE product_id = p.id AND is_primary = 1
     ) img
     OUTER APPLY (
       SELECT AVG(CAST(rating AS FLOAT)) AS avg_rating,
              COUNT(*) AS review_count
       FROM Reviews WHERE product_id = p.id
     ) rv
     ${where}
     ORDER BY ${sortCol} ${sortDir}
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    inputs
  );

  return { data: result.recordset, pagination: { page: +page, limit: +limit, total, pages: Math.ceil(total / +limit) } };
};

// ── Dashboard: tránh nhiều round-trips – dùng 1 query ─
exports.getDashboardOptimized = async (period = 30) => {
  const inputs = [{ name: 'p', type: sql.Int, value: +period }];

  const [stats, recentOrders, topProducts, chart] = await Promise.all([
    query(
      `SELECT
         (SELECT ISNULL(SUM(total),0) FROM Orders WHERE status!='cancelled' AND created_at>=DATEADD(DAY,-@p,GETDATE())) AS revenue,
         (SELECT COUNT(1) FROM Orders WHERE created_at>=DATEADD(DAY,-@p,GETDATE())) AS orders,
         (SELECT COUNT(1) FROM Users WHERE role='user' AND created_at>=DATEADD(DAY,-@p,GETDATE())) AS new_users,
         (SELECT COUNT(1) FROM Products WHERE is_active=1) AS total_products,
         (SELECT COUNT(1) FROM Products WHERE is_active=1 AND stock=0) AS out_of_stock`,
      inputs
    ),
    query(
      `SELECT TOP 8 o.id, o.order_code, o.total, o.status, o.created_at, u.name AS customer_name
       FROM Orders o JOIN Users u ON o.user_id=u.id
       ORDER BY o.created_at DESC`
    ),
    query(
      `SELECT TOP 5 p.id, p.name, p.sold, p.price, p.sale_price,
              (SELECT TOP 1 url FROM ProductImages WHERE product_id=p.id AND is_primary=1) AS image
       FROM Products p WHERE p.is_active=1 ORDER BY p.sold DESC`
    ),
    query(
      `SELECT CONVERT(DATE, created_at) AS date,
              SUM(total) AS revenue, COUNT(1) AS orders
       FROM Orders
       WHERE status!='cancelled' AND created_at>=DATEADD(DAY,-@p,GETDATE())
       GROUP BY CONVERT(DATE, created_at)
       ORDER BY date`,
      inputs
    ),
  ]);

  return {
    stats:         stats.recordset[0],
    recent_orders: recentOrders.recordset,
    top_products:  topProducts.recordset,
    sales_chart:   chart.recordset,
  };
};
