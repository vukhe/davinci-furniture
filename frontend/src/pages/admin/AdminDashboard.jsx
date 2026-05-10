import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { adminAPI } from '../../services/api';
import RevenueForecastChart from '../../components/ai/RevenueForecastChart';
import { formatPrice } from '../../utils/format';
import { Spinner, StatusBadge } from '../../components/common';

// ── Admin Layout ──────────────────────────────────────
export const AdminLayout = () => {
  const { user } = useSelector((s) => s.auth);
  const { pathname } = useLocation();
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  const NAV = [
    { to: '/admin',             label: '📊 Dashboard',      exact: true  },
    { to: '/admin/products',    label: '📦 Sản phẩm',       exact: false },
    { to: '/admin/orders',      label: '🧾 Đơn hàng',       exact: false },
    { to: '/admin/users',       label: '👥 Người dùng',     exact: false },
    { to: '/admin/analytics',   label: '🔷 Analytics & BI', exact: false },
    { to: '/admin/collections', label: '🗂️ Bộ sưu tập', exact: false },
    { to: '/admin/blog',        label: '📰 Blog',    exact: false },
    { to: '/admin/vouchers',    label: '🎯 Voucher', exact: false },
    { to: '/admin/design',      label: '🪑 Tư vấn thiết kế', exact: false },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50 font-body">
      {/* Sidebar */}
      <aside className="w-56 bg-dark text-white flex flex-col flex-shrink-0">
        <Link to="/" className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
          <div className="w-7 h-7 bg-primary-500 rounded-sm flex items-center justify-center">
            <span className="text-white font-accent font-bold text-xs">D</span>
          </div>
          <span className="font-accent text-base tracking-wider text-white">DAVINCI Admin</span>
        </Link>
        <nav className="flex-1 py-4">
          {NAV.map(({ to, label, exact }) => {
            const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + '/');
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center px-5 py-3.5 text-base transition-colors ${
                  active
                    ? 'bg-primary-500/20 text-primary-300 border-r-2 border-primary-500'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-800 px-5 py-4">
          <p className="text-xs text-gray-500">{user.name}</p>
          <p className="text-xs text-primary-400">{user.role}</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};

// ── Dashboard Page ────────────────────────────────────
const AdminDashboard = () => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState('30');

  useEffect(() => {
    setLoading(true);
    adminAPI.getDashboard({ period })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );

  const { stats, recent_orders, top_products } = data;

  const STAT_CARDS = [
    { label: 'Doanh thu',     value: formatPrice(stats.total_revenue), icon: '💰', color: 'bg-green-50 text-green-600' },
    { label: 'Đơn hàng',     value: stats.total_orders,               icon: '📦', color: 'bg-blue-50 text-blue-600' },
    { label: 'Sản phẩm',     value: stats.total_products,             icon: '🛋️', color: 'bg-amber-50 text-amber-600' },
    { label: 'Khách mới',    value: stats.new_users,                  icon: '👤', color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-3xl text-dark">Dashboard</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="border border-gray-200 rounded px-3 py-2 text-sm bg-white focus:outline-none"
        >
          <option value="7">7 ngày qua</option>
          <option value="30">30 ngày qua</option>
          <option value="90">90 ngày qua</option>
        </select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {STAT_CARDS.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-100 p-5 shadow-sm">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${color} text-xl mb-3`}>
              {icon}
            </div>
            <p className="text-base text-gray-500 mb-1">{label}</p>
            <p className="font-heading text-3xl text-dark font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="font-heading text-base">Đơn hàng gần đây</h2>
            <Link to="/admin/orders" className="text-xs text-primary-500 hover:underline">Xem tất cả →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="px-5 py-3 text-left">Mã đơn</th>
                  <th className="px-5 py-3 text-left">Khách hàng</th>
                  <th className="px-5 py-3 text-right">Tổng tiền</th>
                  <th className="px-5 py-3 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent_orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <Link to={`/admin/orders/${order.id}`} className="text-primary-500 hover:underline font-medium">
                        {order.order_code}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{order.customer_name}</td>
                    <td className="px-5 py-3.5 text-right font-medium">{formatPrice(order.total)}</td>
                    <td className="px-5 py-3.5 text-center"><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="font-heading text-base">Bán chạy nhất</h2>
          </div>
          <div className="p-4 space-y-4">
            {top_products.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-300 w-4">#{i + 1}</span>
                <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                  <img src={p.image || '/placeholder.jpg'} alt={p.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">Đã bán: {p.sold}</p>
                </div>
                <p className="text-sm font-semibold text-primary-600 flex-shrink-0">
                  {formatPrice(p.sale_price || p.price)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <RevenueForecastChart />
      </div>
    </div>
  );
};

export default AdminDashboard;
