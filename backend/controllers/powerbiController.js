/**
 * Power BI Embedded Controller
 * Docs: https://learn.microsoft.com/en-us/power-bi/developer/embedded
 *
 * Setup:
 * 1. Đăng ký app tại https://app.powerbi.com → Settings → Developer settings
 * 2. Tạo Service Principal: Azure AD → App registrations
 * 3. Thêm workspace ID và report ID vào .env
 */

const { AppError } = require('../middleware/errorHandler');
const { query, sql } = require('../config/db');

// Lấy Azure AD token (service principal)
const getAzureToken = async () => {
  const tenantId     = process.env.POWERBI_TENANT_ID;
  const clientId     = process.env.POWERBI_CLIENT_ID;
  const clientSecret = process.env.POWERBI_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) return null;

  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'client_credentials',
          client_id:     clientId,
          client_secret: clientSecret,
          scope:         'https://analysis.windows.net/powerbi/api/.default',
        }),
      }
    );
    const data = await response.json();
    return data.access_token;
  } catch {
    return null;
  }
};

// GET /api/admin/powerbi/token
exports.getEmbedToken = async (req, res) => {
  const accessToken  = await getAzureToken();
  const workspaceId  = process.env.POWERBI_WORKSPACE_ID;
  const reportId     = process.env.POWERBI_REPORT_ID;

  // Nếu chưa cấu hình Power BI → trả về chế độ "demo" dùng dữ liệu từ DB
  if (!accessToken || !workspaceId) {
    return res.json({ success: true, mode: 'demo', embedToken: null });
  }

  try {
    const embedRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}/GenerateToken`,
      {
        method:  'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ accessLevel: 'View' }),
      }
    );
    const { token, expiration } = await embedRes.json();

    const reportRes = await fetch(
      `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/reports/${reportId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const report = await reportRes.json();

    res.json({
      success: true,
      mode: 'embedded',
      embedToken: token,
      expiration,
      embedUrl: report.embedUrl,
      reportId,
    });
  } catch (err) {
    res.json({ success: true, mode: 'demo', embedToken: null });
  }
};

// GET /api/admin/powerbi/reports – lấy analytics data từ DB để vẽ chart nội bộ
exports.getReports = async (req, res) => {
  const { period = '30' } = req.query;

  const [
    revenueByDay,
    revenueByCategory,
    ordersByStatus,
    topCustomers,
    topProducts,
    userGrowth,
    hourlyOrders,
  ] = await Promise.all([

    // Doanh thu theo ngày
    query(`
      SELECT CONVERT(DATE, created_at) AS date,
             SUM(total) AS revenue,
             COUNT(*) AS orders
      FROM Orders
      WHERE status != 'cancelled'
        AND created_at >= DATEADD(DAY, -@p, GETDATE())
      GROUP BY CONVERT(DATE, created_at)
      ORDER BY date`,
      [{ name: 'p', type: sql.Int, value: parseInt(period) }]
    ),

    // Doanh thu theo danh mục
    query(`
      SELECT cat.name AS category,
             SUM(oi.price * oi.quantity) AS revenue,
             SUM(oi.quantity) AS units_sold
      FROM OrderItems oi
      JOIN Products p   ON oi.product_id = p.id
      JOIN Categories cat ON p.category_id = cat.id
      JOIN Orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
        AND o.created_at >= DATEADD(DAY, -@p, GETDATE())
      GROUP BY cat.name
      ORDER BY revenue DESC`,
      [{ name: 'p', type: sql.Int, value: parseInt(period) }]
    ),

    // Đơn hàng theo trạng thái
    query(`
      SELECT status,
             COUNT(*) AS count,
             SUM(total) AS total_value
      FROM Orders
      WHERE created_at >= DATEADD(DAY, -@p, GETDATE())
      GROUP BY status`,
      [{ name: 'p', type: sql.Int, value: parseInt(period) }]
    ),

    // Top 10 khách hàng
    query(`
      SELECT TOP 10
             u.id, u.name, u.email,
             COUNT(o.id) AS order_count,
             SUM(o.total) AS total_spent,
             MAX(o.created_at) AS last_order
      FROM Users u
      JOIN Orders o ON u.id = o.user_id
      WHERE o.status != 'cancelled'
        AND o.created_at >= DATEADD(DAY, -@p, GETDATE())
      GROUP BY u.id, u.name, u.email
      ORDER BY total_spent DESC`,
      [{ name: 'p', type: sql.Int, value: parseInt(period) }]
    ),

    // Top 10 sản phẩm bán chạy
    query(`
      SELECT TOP 10
             p.id, p.name,
             SUM(oi.quantity) AS units_sold,
             SUM(oi.price * oi.quantity) AS revenue,
             cat.name AS category
      FROM OrderItems oi
      JOIN Products p ON oi.product_id = p.id
      JOIN Categories cat ON p.category_id = cat.id
      JOIN Orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
        AND o.created_at >= DATEADD(DAY, -@p, GETDATE())
      GROUP BY p.id, p.name, cat.name
      ORDER BY units_sold DESC`,
      [{ name: 'p', type: sql.Int, value: parseInt(period) }]
    ),

    // Tăng trưởng user theo tuần
    query(`
      SELECT DATEPART(YEAR, created_at) AS year,
             DATEPART(WEEK, created_at) AS week,
             COUNT(*) AS new_users
      FROM Users
      WHERE role = 'user'
        AND created_at >= DATEADD(DAY, -@p, GETDATE())
      GROUP BY DATEPART(YEAR, created_at), DATEPART(WEEK, created_at)
      ORDER BY year, week`,
      [{ name: 'p', type: sql.Int, value: parseInt(period) }]
    ),

    // Đơn hàng theo giờ trong ngày (peak hours)
    query(`
      SELECT DATEPART(HOUR, created_at) AS hour,
             COUNT(*) AS orders
      FROM Orders
      WHERE created_at >= DATEADD(DAY, -@p, GETDATE())
      GROUP BY DATEPART(HOUR, created_at)
      ORDER BY hour`,
      [{ name: 'p', type: sql.Int, value: parseInt(period) }]
    ),
  ]);

  res.json({
    success: true,
    data: {
      revenueByDay:      revenueByDay.recordset,
      revenueByCategory: revenueByCategory.recordset,
      ordersByStatus:    ordersByStatus.recordset,
      topCustomers:      topCustomers.recordset,
      topProducts:       topProducts.recordset,
      userGrowth:        userGrowth.recordset,
      hourlyOrders:      hourlyOrders.recordset,
    },
  });
};
