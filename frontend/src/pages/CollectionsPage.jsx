import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import ProductCard from '../components/product/ProductCard';
import { Spinner, EmptyState, Breadcrumb, SectionTitle } from '../components/common';

const api = (url, params) => axios.get(`/api${url}`, { params }).then(r => r.data);

// ── Trang danh sách bộ sưu tập ────────────────────
export const CollectionsListPage = () => {
  const [collections, setCollections] = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    api('/collections').then(r => setCollections(r.data || [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-32"><Spinner size="lg"/></div>;

  return (
    <div>
      {/* Hero */}
      <div className="bg-stone-900 py-20 text-center">
        <p className="font-accent text-xs tracking-[0.4em] text-primary-400 uppercase mb-3">DaVinci Furniture</p>
        <h1 className="font-heading text-4xl md:text-5xl text-white mb-4">Bộ sưu tập</h1>
        <p className="text-stone-400 max-w-md mx-auto text-lg">Các bộ sưu tập đồ gỗ cao cấp, được tuyển chọn kỹ lưỡng</p>
      </div>

      <div className="container mx-auto px-4 py-16">

        {collections.length === 0 ? (
          <EmptyState icon="🪵" title="Chưa có bộ sưu tập" description="Quay lại sau nhé!" />
        ) : (
          <div>
            <p className="text-stone-400 text-sm mb-6">Tất cả bộ sưu tập</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {collections.map((col, i) => (
                <motion.div
                  key={col.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link to={`/collections/${col.slug}`} className="group block relative rounded-sm overflow-hidden">
                    <div className="aspect-[16/9] bg-stone-800 overflow-hidden">
                      {col.banner_image ? (
                        <img src={col.banner_image} alt={col.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl">🪵</div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <p className="text-xs text-primary-300 tracking-widest uppercase mb-1">
                        {col.product_count} sản phẩm
                      </p>
                      <h2 className="font-heading text-white text-3xl mb-2">{col.name}</h2>
                      {col.description && (
                        <p className="text-white/70 text-sm line-clamp-2 max-w-md">{col.description}</p>
                      )}
                      <span className="inline-flex items-center gap-2 text-white/80 text-sm mt-3 group-hover:gap-3 transition-all">
                        Khám phá bộ sưu tập →
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Trang chi tiết bộ sưu tập ─────────────────────
export const CollectionDetailPage = () => {
  const { slug } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);

  useEffect(() => {
    setLoading(true);
    api(`/collections/${slug}`, { page, limit: 12 })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [slug, page]);

  if (loading && !data) return <div className="flex justify-center py-32"><Spinner size="lg"/></div>;
  if (!data) return null;

  const { collection, products, pagination } = data;

  return (
    <div>
      {/* Hero banner */}
      <div className="relative h-72 md:h-96 overflow-hidden bg-stone-800">
        {collection.banner_image && (
          <img src={collection.banner_image} alt={collection.name}
            className="w-full h-full object-cover opacity-70" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-end pb-12 px-8">
          <div className="container mx-auto">
            <p className="font-accent text-xs tracking-[0.4em] text-primary-300 uppercase mb-3">Bộ sưu tập</p>
            <h1 className="font-heading text-4xl md:text-6xl text-white mb-3">{collection.name}</h1>
            {collection.description && (
              <p className="text-white/75 text-lg max-w-xl">{collection.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <Breadcrumb items={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Bộ sưu tập', to: '/collections' },
          { label: collection.name },
        ]} />

        <div className="flex items-center justify-between mb-8">
          <p className="text-stone-400 text-lg">{pagination.total} sản phẩm</p>
        </div>

        {products.length === 0 ? (
          <EmptyState icon="🛒" title="Bộ sưu tập chưa có sản phẩm" />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
            </div>

            {pagination.pages > 1 && (
              <div className="flex justify-center mt-12 gap-2">
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-11 h-11 text-base rounded-sm transition-colors ${
                      p === page ? 'bg-dark text-white' : 'border border-gray-200 hover:border-dark'
                    }`}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CollectionsListPage;
