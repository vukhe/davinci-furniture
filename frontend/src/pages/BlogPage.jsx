import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { blogAPI } from '../services/api';
import { formatDate, truncate } from '../utils/format';
import { Spinner, EmptyState, Breadcrumb, SectionTitle } from '../components/common';
import { motion } from 'framer-motion';

const BlogPage = () => {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);

  useEffect(() => {
    setLoading(true);
    blogAPI.getAll({ page, limit: 9, search: search || undefined })
      .then((res) => setPosts(res.data || []))
      .finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div>
      {/* Hero */}
      <div className="bg-dark py-20 text-center">
        <p className="font-accent text-xs tracking-[0.4em] text-primary-400 uppercase mb-3">DaVinci Blog</p>
        <h1 className="font-heading text-4xl md:text-5xl text-white mb-4">Cảm hứng nội thất</h1>
        <p className="text-gray-400 max-w-md mx-auto">Khám phá xu hướng thiết kế, tips trang trí nhà và kiến thức nội thất</p>
      </div>

      <div className="container mx-auto px-4 py-14">
        {/* Search */}
        <div className="flex justify-center mb-10">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm kiếm bài viết..."
              className="w-full border border-gray-200 rounded-sm pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-primary-500"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : posts.length === 0 ? (
          <EmptyState icon="📝" title="Chưa có bài viết nào" description="Hãy quay lại sau nhé!" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post, i) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="group bg-white border border-gray-100 rounded-sm shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <Link to={`/blog/${post.slug}`}>
                  <div className="aspect-video overflow-hidden bg-gray-200">
                    {post.thumbnail ? (
                      <img
                        src={post.thumbnail}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🛋️</div>
                    )}
                  </div>
                </Link>
                <div className="p-5">
                  <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
                    <span>{post.author_name}</span>
                    <span>·</span>
                    <span>{formatDate(post.created_at)}</span>
                    <span>·</span>
                    <span>{post.views} lượt xem</span>
                  </div>
                  <Link to={`/blog/${post.slug}`}>
                    <h2 className="font-heading text-lg text-dark group-hover:text-primary-600 transition-colors mb-2 line-clamp-2 leading-snug">
                      {post.title}
                    </h2>
                  </Link>
                  {post.excerpt && (
                    <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">{post.excerpt}</p>
                  )}
                  <Link
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-1 text-xs text-primary-500 hover:gap-2 transition-all mt-4 font-medium"
                  >
                    Đọc tiếp →
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogPage;
