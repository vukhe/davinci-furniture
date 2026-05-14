/**
 * frontend/src/components/ai/SimilarProducts.jsx
 * Widget "Sản phẩm tương tự" – nhúng vào ProductDetailPage.jsx
 *
 * CÁCH DÙNG trong ProductDetailPage.jsx:
 *   import SimilarProducts from '../../components/ai/SimilarProducts';
 *   // Thêm vào cuối trang:
 *   <SimilarProducts productId={product.ProductID} />
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../../utils/format";

const BASE = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

function ProductCard({ product }) {
  return (
    <Link
      to={`/products/${product.slug || product.product_id || product.id}`}
      className="group block border border-stone-100 rounded-xl overflow-hidden hover:border-davinci-gold hover:shadow-lg transition-all duration-300"
    >
      <div className="aspect-[4/3] bg-stone-50 overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => (e.target.src = "/placeholder.jpg")}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-200 text-4xl">🛋️</div>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">{product.category_name || product.category}</p>
        <p className="text-sm font-medium text-stone-800 line-clamp-2 leading-snug group-hover:text-davinci-gold transition-colors">
          {product.name}
        </p>
        <p className="text-sm font-semibold text-davinci-gold mt-2">
          {formatPrice(product.sale_price || product.price)}
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
        <div className="h-3 bg-stone-100 rounded w-1/2" />
        <div className="h-4 bg-stone-100 rounded" />
        <div className="h-4 bg-stone-100 rounded w-3/4" />
        <div className="h-4 bg-stone-100 rounded w-1/3 mt-1" />
      </div>
    </div>
  );
}

export default function SimilarProducts({ productId, limit = 6, className = "" }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError(false);

    fetch(`${BASE}/api/ai-proxy/recommend/similar/${productId}?limit=${limit}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setProducts(data.results || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [productId, limit]);

  // Không render nếu không có kết quả và không đang load
  if (!loading && (error || products.length === 0)) return null;

  return (
    <section className={`mt-16 border-t border-stone-100 pt-12 ${className}`.trim()}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-heading font-semibold text-stone-800">
            Sản phẩm tương tự
          </h2>
          <p className="text-sm text-stone-400 mt-1 flex items-center gap-1">
            <span className="text-[10px] font-semibold text-davinci-gold bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">AI</span>
            Gợi ý dựa trên phân tích ngữ nghĩa
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: limit }).map((_, i) => <SkeletonCard key={i} />)
          : products.map((p) => <ProductCard key={p.product_id} product={p} />)
        }
      </div>
    </section>
  );
}
