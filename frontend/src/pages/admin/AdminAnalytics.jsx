import { useEffect, useState, useRef } from 'react';
import { adminAPI } from '../../services/api';
import RevenueForecastChart from '../../components/ai/RevenueForecastChart';
import TrendingProducts from '../../components/ai/TrendingProducts';
import { formatPrice, formatDate } from '../../utils/format';
import { Spinner } from '../../components/common';

// ── Tiny chart helpers (no extra lib needed) ──────────
const BAR_COLORS = ['#c47a2e','#e8913a','#efb265','#f5d09d','#a36022','#834a1c','#6b3d1a','#59321a','#fae9d0','#fdf6ee'];
const STATUS_COLOR = { pending:'#f59e0b', confirmed:'#3b82f6', shipping:'#8b5cf6', completed:'#10b981', cancelled:'#ef4444' };
const STATUS_LABEL = { pending:'Chờ xác nhận', confirmed:'Đã xác nhận', shipping:'Đang giao', completed:'Hoàn thành', cancelled:'Đã hủy' };

// Simple SVG line chart
const LineChart = ({ data = [], xKey = 'date', yKey = 'revenue', color = '#c47a2e', height = 160 }) => {
  if (!data.length) return null;
  const W = 600, H = height;
  const pad = { t: 10, r: 20, b: 30, l: 60 };
  const vals = data.map(d => Number(d[yKey]) || 0);
  const maxV = Math.max(...vals, 1);
  const minV = 0;
  const xs = data.map((_, i) => pad.l + (i / Math.max(data.length - 1, 1)) * (W - pad.l - pad.r));
  const ys = vals.map(v => pad.t + (1 - (v - minV) / (maxV - minV)) * (H - pad.t - pad.b));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const area = `${path} L${xs[xs.length-1]},${H - pad.b} L${xs[0]},${H - pad.b} Z`;
  const ticks = 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`grad-${yKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Y grid */}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const y = pad.t + (i / ticks) * (H - pad.t - pad.b);
        const val = maxV - (i / ticks) * maxV;
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#f0ece6" strokeWidth="1" />
            <text x={pad.l - 6} y={y + 4} fontSize="9" fill="#aaa" textAnchor="end">
              {val >= 1e6 ? `${(val/1e6).toFixed(0)}M` : val >= 1e3 ? `${(val/1e3).toFixed(0)}K` : val.toFixed(0)}
            </text>
          </g>
        );
      })}
      {/* Area */}
      <path d={area} fill={`url(#grad-${yKey})`} />
      {/* Line */}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots + X labels */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i]} r="3.5" fill={color} />
          {(i === 0 || i === data.length - 1 || i % Math.ceil(data.length / 6) === 0) && (
            <text x={xs[i]} y={H - pad.b + 14} fontSize="9" fill="#999" textAnchor="middle">
              {String(d[xKey]).slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

// Horizontal bar chart
const HBarChart = ({ data = [], labelKey = 'name', valueKey = 'revenue', max: maxOverride }) => {
  if (!data.length) return null;
  const max = maxOverride || Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 truncate max-w-[60%]">{d[labelKey]}</span>
              <span className="font-medium text-dark">
                {val >= 1e6 ? `${(val/1e6).toFixed(1)}M` : val >= 1e3 ? `${(val/1e3).toFixed(0)}K` : val}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Donut chart
const DonutChart = ({ data = [], labelKey = 'status', valueKey = 'count', colorFn }) => {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + (Number(d[valueKey]) || 0), 0);
  let cum = 0;
  const slices = data.map((d, i) => {
    const val = Number(d[valueKey]) || 0;
    const pct = val / total;
    const start = cum;
    cum += pct;
    const a1 = start * 2 * Math.PI - Math.PI / 2;
    const a2 = cum  * 2 * Math.PI - Math.PI / 2;
    const r = 70, cx = 90, cy = 90;
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
    const large = pct > 0.5 ? 1 : 0;
    return { d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`,
             color: colorFn ? colorFn(d[labelKey]) : BAR_COLORS[i], val, pct, label: d[labelKey] };
  });

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg viewBox="0 0 180 180" className="w-32 h-32 flex-shrink-0">
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.color} stroke="white" strokeWidth="2" />)}
        <circle cx="90" cy="90" r="42" fill="white" />
        <text x="90" y="87" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#1a1a1a">{total}</text>
        <text x="90" y="101" textAnchor="middle" fontSize="9" fill="#aaa">đơn hàng</text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-gray-500 flex-1">{STATUS_LABEL[s.label] || s.label}</span>
            <span className="text-xs font-medium">{s.val}</span>
            <span className="text-xs text-gray-400">({(s.pct * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Peak hours heatmap-style
const HourlyChart = ({ data = [] }) => {
  if (!data.length) return null;
  const hours = Array.from({ length: 24 }, (_, h) => {
    const found = data.find(d => Number(d.hour) === h);
    return { hour: h, orders: found ? Number(found.orders) : 0 };
  });
  const max = Math.max(...hours.map(h => h.orders), 1);
  return (
    <div className="flex gap-1 items-end">
      {hours.map(({ hour, orders }) => (
        <div key={hour} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm transition-all duration-500"
            style={{
              height: `${Math.max((orders / max) * 80, orders > 0 ? 4 : 2)}px`,
              backgroundColor: orders > max * 0.7 ? '#c47a2e' : orders > max * 0.4 ? '#e8913a' : orders > 0 ? '#fae9d0' : '#f5f5f5',
            }}
            title={`${hour}:00 – ${orders} đơn`}
          />
          {hour % 6 === 0 && <span className="text-[8px] text-gray-400">{hour}h</span>}
        </div>
      ))}
    </div>
  );
};

// ── Main Dashboard ─────────────────────────────────────
const AdminAnalytics = () => {
  const [data,    setData]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState('30');
  const [tab,     setTab]     = useState('overview');
  const embedRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminAPI.getAdminReports({ period }),
      adminAPI.getPowerBIToken(),
    ])
      .then(([reports, pbi]) => {
        setData(reports.data);
        setToken(pbi);
      })
      .finally(() => setLoading(false));
  }, [period]);

  // Load Power BI SDK nếu có token
  useEffect(() => {
    if (!token?.embedToken || !embedRef.current) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/powerbi-client@2.23.1/dist/powerbi.min.js';
    script.onload = () => {
      const powerbi = window.powerbi;
      powerbi.embed(embedRef.current, {
        type:        'report',
        embedUrl:    token.embedUrl,
        accessToken: token.embedToken,
        tokenType:   1,
        settings:    { navContentPaneEnabled: false, filterPaneEnabled: false },
      });
    };
    document.head.appendChild(script);
  }, [token]);

  if (loading) return <div className="flex items-center justify-center h-96"><Spinner size="lg" /></div>;
  if (!data)   return null;

  const totalRevenue = data.revenueByDay.reduce((s, d) => s + Number(d.revenue), 0);
  const totalOrders  = data.revenueByDay.reduce((s, d) => s + Number(d.orders), 0);

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-3xl text-dark">Analytics & Power BI</h1>
          <p className="text-sm text-gray-400 mt-0.5">Phân tích dữ liệu kinh doanh thời gian thực</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-200 rounded-sm px-3 py-2 text-sm bg-white focus:outline-none focus:border-primary-500"
          >
            <option value="7">7 ngày qua</option>
            <option value="30">30 ngày qua</option>
            <option value="90">90 ngày qua</option>
            <option value="365">1 năm qua</option>
          </select>
          <span className="text-xs text-gray-400 bg-green-50 text-green-600 px-2 py-1 rounded-full border border-green-100">
            ● Live
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-100 rounded-sm p-1 w-fit shadow-sm">
        {[
          { key: 'overview',   label: '📊 Tổng quan' },
          { key: 'sales',      label: '💰 Doanh thu' },
          { key: 'customers',  label: '👥 Khách hàng' },
          { key: 'products',   label: '📦 Sản phẩm' },
          { key: 'powerbi',    label: '🔷 Power BI' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-xs font-medium rounded-sm transition-colors ${
              tab === key ? 'bg-dark text-white' : 'text-gray-500 hover:text-dark'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Doanh thu',      value: formatPrice(totalRevenue), icon: '💰', trend: '+12%', up: true },
              { label: 'Đơn hàng',       value: totalOrders,               icon: '📦', trend: '+8%',  up: true },
              { label: 'Khách hàng top', value: data.topCustomers[0]?.name?.split(' ').slice(-1)[0] || '—', icon: '👑', trend: `${formatPrice(data.topCustomers[0]?.total_spent)}`, up: true },
              { label: 'Giờ cao điểm',   value: (() => { const pk = [...data.hourlyOrders].sort((a,b)=>b.orders-a.orders)[0]; return pk ? `${pk.hour}:00` : '—'; })(), icon: '⏰', trend: `${[...data.hourlyOrders].sort((a,b)=>b.orders-a.orders)[0]?.orders || 0} đơn`, up: false },
            ].map(({ label, value, icon, trend, up }) => (
              <div key={label} className="bg-white rounded-sm border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{icon}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${up ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                    {trend}
                  </span>
                </div>
                <p className="font-heading text-xl font-bold text-dark truncate">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Revenue line + Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white rounded-sm border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-lg">Doanh thu theo ngày</h3>
                <span className="text-xs text-gray-400">{formatPrice(totalRevenue)} tổng</span>
              </div>
              <LineChart data={data.revenueByDay} xKey="date" yKey="revenue" />
            </div>
            <div className="bg-white rounded-sm border border-gray-100 shadow-sm p-5">
              <h3 className="font-heading text-lg mb-4">Trạng thái đơn hàng</h3>
              <DonutChart data={data.ordersByStatus} labelKey="status" valueKey="count" colorFn={(s) => STATUS_COLOR[s] || '#ccc'} />
            </div>
          </div>

          {/* Hourly + Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-sm border border-gray-100 shadow-sm p-5">
              <h3 className="font-heading text-lg mb-1">Giờ cao điểm đặt hàng</h3>
              <p className="text-xs text-gray-400 mb-4">Số đơn hàng theo từng giờ trong ngày</p>
              <HourlyChart data={data.hourlyOrders} />
            </div>
            <div className="bg-white rounded-sm border border-gray-100 shadow-sm p-5">
              <h3 className="font-heading text-lg mb-4">Doanh thu theo danh mục</h3>
              <HBarChart data={data.revenueByCategory} labelKey="category" valueKey="revenue" />
            </div>
          </div>

          <RevenueForecastChart />
        </div>
      )}

      {/* ── SALES ────────────────────────────────── */}
      {tab === 'sales' && (
        <div className="space-y-5">
          <div className="bg-white rounded-sm border border-gray-100 shadow-sm p-5">
            <h3 className="font-heading text-lg mb-4">Biểu đồ doanh thu & số đơn</h3>
            <LineChart data={data.revenueByDay} xKey="date" yKey="revenue" height={200} />
            <div className="mt-5 border-t pt-4">
              <LineChart data={data.revenueByDay} xKey="date" yKey="orders" color="#3b82f6" height={120} />
              <p className="text-xs text-center text-gray-400 mt-1">Số đơn hàng</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-sm border border-gray-100 shadow-sm p-5">
              <h3 className="font-heading text-lg mb-4">Doanh thu theo danh mục</h3>
              <HBarChart data={data.revenueByCategory} labelKey="category" valueKey="revenue" />
            </div>
            <div className="bg-white rounded-sm border border-gray-100 shadow-sm p-5">
              <h3 className="font-heading text-lg mb-4">Số lượng bán theo danh mục</h3>
              <HBarChart data={data.revenueByCategory} labelKey="category" valueKey="units_sold" />
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMERS ───────────────────────────── */}
      {tab === 'customers' && (
        <div className="space-y-5">
          <div className="bg-white rounded-sm border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-heading text-lg">Top 10 khách hàng chi tiêu nhiều nhất</h3>
              <span className="text-xs text-gray-400">Trong {period} ngày qua</span>
            </div>
            <table className="w-full text-base">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">#</th>
                  <th className="px-5 py-3 text-left">Khách hàng</th>
                  <th className="px-5 py-3 text-center">Đơn hàng</th>
                  <th className="px-5 py-3 text-right">Tổng chi tiêu</th>
                  <th className="px-5 py-3 text-right">Đơn gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.topCustomers.map((c, i) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold ${i < 3 ? 'text-primary-500' : 'text-gray-300'}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-dark">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="bg-blue-50 text-blue-600 text-xs font-medium px-2 py-0.5 rounded-full">{c.order_count}</span>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-primary-600">{formatPrice(c.total_spent)}</td>
                    <td className="px-5 py-4 text-right text-xs text-gray-400">{formatDate(c.last_order)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.userGrowth.length > 0 && (
            <div className="bg-white rounded-sm border border-gray-100 shadow-sm p-5">
              <h3 className="font-heading text-lg mb-4">Tăng trưởng người dùng mới theo tuần</h3>
              <HBarChart data={data.userGrowth.map(d => ({ ...d, label: `Tuần ${d.week}` }))} labelKey="label" valueKey="new_users" />
            </div>
          )}
        </div>
      )}

      {/* ── PRODUCTS ─────────────────────────────── */}
      {tab === 'products' && (
        <div className="space-y-5">
          <TrendingProducts days={Number(period) >= 90 ? 60 : 30} limit={10} />

          <div className="bg-white rounded-sm border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="font-heading text-lg">Top 10 sản phẩm bán chạy nhất</h3>
            </div>
            <table className="w-full text-base">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-5 py-3 text-left">#</th>
                  <th className="px-5 py-3 text-left">Sản phẩm</th>
                  <th className="px-5 py-3 text-left">Danh mục</th>
                  <th className="px-5 py-3 text-center">Đã bán</th>
                  <th className="px-5 py-3 text-right">Doanh thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.topProducts.map((p, i) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-xs font-bold text-gray-400">#{i+1}</td>
                    <td className="px-5 py-4 font-medium text-dark max-w-[200px] truncate">{p.name}</td>
                    <td className="px-5 py-4 text-gray-500 text-sm">{p.category}</td>
                    <td className="px-5 py-4 text-center">
                      <span className="bg-primary-50 text-primary-700 text-xs font-medium px-2 py-0.5 rounded-full">{p.units_sold}</span>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">{formatPrice(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-sm border border-gray-100 shadow-sm p-5">
            <h3 className="font-heading text-lg mb-4">Doanh thu sản phẩm top 10</h3>
            <HBarChart data={data.topProducts} labelKey="name" valueKey="revenue" />
          </div>
        </div>
      )}

      {/* ── POWER BI ─────────────────────────────── */}
      {tab === 'powerbi' && (
        <div className="space-y-5">
          {token?.mode === 'embedded' ? (
            <div className="bg-white rounded-sm border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center gap-2">
                <span className="text-blue-600 text-lg">🔷</span>
                <h3 className="font-heading text-lg">Power BI Report</h3>
                <span className="ml-auto text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Đã kết nối</span>
              </div>
              <div ref={embedRef} className="w-full" style={{ height: '600px' }} />
            </div>
          ) : (
            <>
              {/* Setup guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-sm p-5">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🔷</span>
                  <div>
                    <h3 className="font-heading text-base text-blue-800 mb-1">Kết nối Power BI Embedded</h3>
                    <p className="text-sm text-blue-700 mb-4">
                      Để hiển thị báo cáo Power BI thật, bạn cần cấu hình Azure AD và điền thông tin vào file <code className="bg-blue-100 px-1 rounded">.env</code>
                    </p>
                    <div className="space-y-2 text-sm text-blue-700">
                      <p className="font-medium">Các bước thực hiện:</p>
                      <ol className="list-decimal pl-5 space-y-1.5">
                        <li>Đăng nhập <a href="https://app.powerbi.com" target="_blank" className="underline">app.powerbi.com</a> → tạo workspace và upload báo cáo</li>
                        <li>Vào <a href="https://portal.azure.com" target="_blank" className="underline">Azure Portal</a> → App registrations → tạo app mới</li>
                        <li>Lấy <strong>Client ID</strong>, <strong>Tenant ID</strong>, tạo <strong>Client Secret</strong></li>
                        <li>Trong Power BI workspace → Settings → Workspaces → Add service principal</li>
                        <li>Điền vào <code className="bg-blue-100 px-1 rounded">.env</code>: POWERBI_CLIENT_ID, POWERBI_CLIENT_SECRET, POWERBI_TENANT_ID, POWERBI_WORKSPACE_ID, POWERBI_REPORT_ID</li>
                        <li>Restart server → tab Power BI sẽ hiển thị báo cáo</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              {/* Demo charts using DB data */}
              <div className="bg-white rounded-sm border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-heading text-lg">📊 Dashboard Analytics (dữ liệu thực từ DB)</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Tương đương Power BI</span>
                </div>
                <p className="text-xs text-gray-400 mb-5">Dữ liệu được lấy trực tiếp từ SQL Server, cập nhật real-time</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Doanh thu {period} ngày</p>
                    <LineChart data={data.revenueByDay} xKey="date" yKey="revenue" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Trạng thái đơn hàng</p>
                    <DonutChart data={data.ordersByStatus} labelKey="status" valueKey="count" colorFn={(s) => STATUS_COLOR[s]} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Top danh mục</p>
                    <HBarChart data={data.revenueByCategory} labelKey="category" valueKey="revenue" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Giờ cao điểm</p>
                    <HourlyChart data={data.hourlyOrders} />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminAnalytics;
