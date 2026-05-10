import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { blogAPI } from '../services/api';
import { formatDate } from '../utils/format';
import { Spinner, Breadcrumb } from '../components/common';

const BlogDetailPage = () => {
  const { slug }          = useParams();
  const [post,   setPost]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    blogAPI.getBySlug(slug)
      .then((res) => setPost(res.data))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  if (!post)   return (
    <div className="text-center py-20 text-gray-400">
      <p className="font-heading text-xl mb-3">Không tìm thấy bài viết</p>
      <Link to="/blog" className="text-primary-500 hover:underline text-sm">← Về trang Blog</Link>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Breadcrumb items={[
        { label: 'Trang chủ', to: '/' },
        { label: 'Blog', to: '/blog' },
        { label: post.title },
      ]} />

      {/* Thumbnail */}
      {post.thumbnail && (
        <div className="rounded-sm overflow-hidden mb-8 aspect-video bg-gray-100">
          <img src={post.thumbnail} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Header */}
      <header className="mb-8">
        <h1 className="font-heading text-3xl md:text-4xl text-dark leading-tight mb-4">{post.title}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-xs">
              {post.author_name?.[0]?.toUpperCase()}
            </div>
            <span>{post.author_name}</span>
          </div>
          <span>·</span>
          <span>{formatDate(post.created_at)}</span>
          <span>·</span>
          <span>{post.views} lượt xem</span>
        </div>
        {post.excerpt && (
          <p className="mt-4 text-gray-500 text-lg leading-relaxed border-l-4 border-primary-300 pl-4 italic">
            {post.excerpt}
          </p>
        )}
      </header>

      {/* Content */}
      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      <hr className="my-10" />

      <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-dark transition-colors">
        ← Quay lại Blog
      </Link>
    </div>
  );
};

export default BlogDetailPage;
