/**
 * frontend/src/components/ai/RecommendationSection.jsx
 * Section "Gợi ý cho bạn" – nhúng vào HomePage.jsx
 *
 * CÁCH DÙNG trong HomePage.jsx:
 *   import RecommendationSection from '../../components/ai/RecommendationSection';
 *   // Thêm vào cuối trang trước footer:
 *   <RecommendationSection />
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";

const BACKEND = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

async function fetchFallbackProducts(limit = 8) {
  try {
    const res = await fetch(
      `${BACKEND}/api/ai-proxy/recommend/popular?limit=${limit}`
    );
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

function ProductCard({ product }) {
  const price = product.sale_price || product.price || 0;
  const name = product.name || "";
  const image = product.image_url || product.image || "";
  const id = product.id || product.product_id;

  return (
    <Link
      to={`/products/${product.slug || id}`}
      className="group block border border-stone-100 rounded-xl overflow-hidden hover:border-davinci-gold hover:shadow-lg transition-all duration-300"
    >
      <div className="aspect-[4/3] bg-stone-50 overflow-hidden relative">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => (e.target.src = "/placeholder.jpg")}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-200 text-3xl">🛋️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-stone-800 line-clamp-2 leading-snug group-hover:text-davinci-gold transition-colors">
          {name}
        </p>
        <p className="text-sm font-semibold text-davinci-gold mt-2">
          {new Intl.NumberFormat("vi-VN").format(price)}₫
        </p>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="border border-stone-100 rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-stone-100" />
      <div className="p-3 space-y-2">
        <div className="h-4 bg-stone-100 rounded" />
        <div className="h-4 bg-stone-100 rounded w-3/4" />
        <div className="h-4 bg-stone-100 rounded w-1/3 mt-2" />
      </div>
    </div>
  );
}

export default function RecommendationSection() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("popular"); // "personalized" | "popular" | "cold_start"

  // Lấy user từ Redux store (authSlice)
  const user = useSelector((state) => state.auth?.user);
  const userId = user?.id || user?.UserID;

  useEffect(() => {
    loadRecommendations();
  }, [userId]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      let endpoint;
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      if (userId && token) {
        endpoint = `${BACKEND}/api/ai-proxy/recommend/for-me?limit=8`;
      } else {
        endpoint = `${BACKEND}/api/ai-proxy/recommend/popular?limit=8`;
      }

      const res = await fetch(endpoint, { headers });
      if (res.status === 401) {
        const fallback = await fetchFallbackProducts(8);
        setProducts(fallback);
        setMode("popular");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      // ai-proxy already enriches with product details
      const products = data.results || [];
      setMode(data.mode || "popular");

      if (products.length === 0) {
        setProducts(await fetchFallbackProducts(8));
        return;
      }
      setProducts(products);
    } catch (err) {
      console.warn("Recommendations unavailable:", err.message);
      setProducts(await fetchFallbackProducts(8));
      setMode("fallback");
    } finally {
      setLoading(false);
    }
  };

  if (!loading && products.length === 0) return null;

  const title = userId && mode === "personalized"
    ? "Gợi ý cho bạn"
    : "Sản phẩm nổi bật";

  const subtitle = userId && mode === "personalized"
    ? "Dựa trên lịch sử mua hàng của bạn"
    : "Được khách hàng yêu thích nhất";

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-3xl font-heading font-semibold text-stone-800">{title}</h2>
          <p className="text-stone-400 mt-1 flex items-center gap-2">
            <span className="text-[10px] font-bold text-davinci-gold bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">AI</span>
            {subtitle}
          </p>
        </div>
        <Link
          to="/products"
          className="text-sm text-davinci-gold hover:underline hidden sm:block"
        >
          Xem tất cả →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : products.map((p) => (
              <ProductCard key={p.ProductID || p.product_id || p.id} product={p} />
            ))}
      </div>

      <div className="mt-6 text-center sm:hidden">
        <Link
          to="/products"
          className="inline-block text-sm text-davinci-gold border border-davinci-gold rounded-lg px-5 py-2 hover:bg-amber-50 transition-colors"
        >
          Xem tất cả sản phẩm →
        </Link>
      </div>
    </section>
  );
}
