import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice } from '../../utils/format';

const BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

function Skeleton() {
  return (
    <div className="border border-stone-100 rounded-xl overflow-hidden animate-pulse">
      <div className="aspect-[4/3] bg-stone-100" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-stone-100 rounded w-1/2" />
        <div className="h-4 bg-stone-100 rounded" />
        <div className="h-4 bg-stone-100 rounded w-1/3" />
      </div>
    </div>
  );
}

function Card({ product }) {
  const discounted = product.sale_price && product.sale_price < product.price;
  return (
    <Link
      to={`/products/${product.slug || product.id || product.product_id}`}
      className="group block border border-stone-100 rounded-xl overflow-hidden hover:border-davinci-gold hover:shadow-lg transition-all duration-300"
    >
      <div className="aspect-[4/3] bg-stone-50 overflow-hidden relative">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={e => { e.target.src = '/placeholder.jpg'; }} />
          : <div className="w-full h-full flex items-center justify-center text-stone-300 text-3xl">🛋️</div>
        }
        {discounted && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            -{Math.round((1 - product.sale_price / product.price) * 100)}%
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-stone-400 truncate mb-1">{product.category_name || product.category}</p>
        <p className="text-sm font-medium text-stone-800 line-clamp-2 leading-snug group-hover:text-davinci-gold transition-colors">{product.name}</p>
        <p className="text-sm font-semibold text-davinci-gold mt-2">{formatPrice(product.sale_price || product.price)}</p>
      </div>
    </Link>
  );
}

export default function CoPurchaseSection({ productId, cartProductIds, limit = 8 }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!productId && !cartProductIds?.length) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = cartProductIds?.length
          ? await fetch(`${BASE}/api/ai-proxy/recommend/for-cart`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ product_ids: cartProductIds }),
            })
          : await fetch(`${BASE}/api/ai-proxy/recommend/co-purchase/${productId}?limit=${limit}`);
        const data = await res.json();
        if (!cancelled) setProducts(data.results || []);
      } catch { if (!cancelled) setProducts([]); }
      finally  { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [productId, JSON.stringify(cartProductIds), limit]);

  if (!loading && !products.length) return null;

  const isCart = !!cartProductIds?.length;
  return (
    <section className="mt-12 border-t border-stone-100 pt-10">
      <div className="mb-6">
        <h2 className="text-2xl font-heading font-semibold text-stone-800">
          {isCart ? 'Có thể bạn cũng thích' : 'Khách hàng cũng mua'}
        </h2>
        <p className="text-sm text-stone-400 mt-1 flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-davinci-gold bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">AI</span>
          {isCart ? 'Dựa trên giỏ hàng của bạn' : 'Thường được mua cùng nhau'}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} />)
          : products.slice(0, limit).map(p => <Card key={p.product_id || p.id} product={p} />)
        }
      </div>
    </section>
  );
}
