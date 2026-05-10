/**
 * frontend/src/components/ai/TrendingProducts.jsx
 * Bảng sản phẩm đang trending – nhúng vào AdminAnalytics.jsx
 *
 * CÁCH DÙNG:
 *   import TrendingProducts from '../../components/ai/TrendingProducts';
 *   <TrendingProducts />
 */
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8000";

function GrowthBadge({ rate }) {
  const isPositive = rate >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
        isPositive
          ? "bg-green-50 text-green-600 border border-green-200"
          : "bg-red-50 text-red-500 border border-red-200"
      }`}
    >
      {isPositive ? "↑" : "↓"} {Math.abs(rate)}%
    </span>
  );
}

export default function TrendingProducts({ days = 30, limit = 10 }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = useSelector((state) => state.auth?.token);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${AI_SERVICE_URL}/api/ai/forecast/trending-products?days=${days}&limit=${limit}&admin_token=${token}`)
      .then((r) => r.json())
      .then((d) => setData(d.trending || []))
      .catch(() => setError("Không thể tải dữ liệu trending"))
      .finally(() => setLoading(false));
  }, [days, limit, token]);

  return (
    <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold text-stone-800 flex items-center gap-2">
            🔥 Sản phẩm xu hướng
            <span className="text-[10px] font-bold text-davinci-gold bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">AI</span>
          </h3>
          <p className="text-xs text-stone-400 mt-0.5">Tăng trưởng doanh số trong {days} ngày gần đây</p>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 animate-pulse">
              <div className="w-8 h-4 bg-stone-100 rounded" />
              <div className="flex-1 h-4 bg-stone-100 rounded" />
              <div className="w-16 h-4 bg-stone-100 rounded" />
              <div className="w-14 h-6 bg-stone-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-center text-sm text-red-400">{error}</div>
      ) : data.length === 0 ? (
        <div className="p-6 text-center text-sm text-stone-400">
          Chưa có đủ dữ liệu để phân tích xu hướng
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-stone-400 uppercase tracking-wide bg-stone-50">
                <th className="px-5 py-3 text-left w-8">#</th>
                <th className="px-5 py-3 text-left">Sản phẩm</th>
                <th className="px-5 py-3 text-right">Gần đây</th>
                <th className="px-5 py-3 text-right">Trước đó</th>
                <th className="px-5 py-3 text-right">Doanh thu</th>
                <th className="px-5 py-3 text-right">Tăng trưởng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {data.map((item, idx) => (
                <tr key={item.product_id} className="hover:bg-stone-50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <span className={`text-sm font-bold ${idx < 3 ? "text-davinci-gold" : "text-stone-300"}`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Link
                      to={`/products/${item.product_id}`}
                      className="text-sm text-stone-700 hover:text-davinci-gold font-medium transition-colors group-hover:underline"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-stone-600">
                    {item.qty_recent_half} sp
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm text-stone-400">
                    {item.qty_older_half} sp
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm font-medium text-stone-700">
                    {new Intl.NumberFormat("vi-VN").format(Math.round(item.revenue_recent))}₫
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <GrowthBadge rate={item.growth_rate} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}