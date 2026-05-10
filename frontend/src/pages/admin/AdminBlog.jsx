import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { formatDate } from '../../utils/format';
import { Button, Spinner, Badge } from '../../components/common';
import toast from 'react-hot-toast';

const EMPTY_FORM = { title: '', excerpt: '', content: '', thumbnail: '', is_published: false };

const AdminBlog = () => {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [search,   setSearch]   = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getBlog({ limit: 50, search: search || undefined });
      setPosts(res.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Xóa bài viết "${title}"?`)) return;
    try {
      await adminAPI.deletePost(id);
      toast.success('Đã xóa bài viết');
      load();
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl text-dark">Quản lý Blog</h1>
        <Button variant="primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          + Viết bài mới
        </Button>
      </div>

      <div className="mb-5">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm bài viết..."
          className="border border-gray-200 rounded-sm px-4 py-2.5 text-sm w-72 focus:outline-none focus:border-primary-500" />
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Chưa có bài viết nào</div>
        ) : (
          <table className="w-full text-base">
            <thead className="bg-gray-50 text-gray-500 text-sm border-b">
              <tr>
                <th className="px-5 py-4 text-left">Tiêu đề</th>
                <th className="px-5 py-4 text-left">Tác giả</th>
                <th className="px-5 py-4 text-center">Lượt xem</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4 text-left">Ngày tạo</th>
                <th className="px-5 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-dark max-w-xs truncate">{post.title}</p>
                    {post.excerpt && <p className="text-xs text-gray-400 truncate max-w-xs">{post.excerpt}</p>}
                  </td>
                  <td className="px-5 py-4 text-gray-500">{post.author_name}</td>
                  <td className="px-5 py-4 text-center text-gray-500">{post.views}</td>
                  <td className="px-5 py-4 text-center">
                    <Badge color={post.is_published ? 'green' : 'gray'}>
                      {post.is_published ? 'Đã đăng' : 'Nháp'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(post.created_at)}</td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setEditing(post); setShowForm(true); }}
                        className="text-xs text-blue-500 hover:underline">Sửa</button>
                      <button onClick={() => handleDelete(post.id, post.title)}
                        className="text-xs text-red-500 hover:underline">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <BlogFormModal
          post={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
};

const BlogFormModal = ({ post, onClose, onSaved }) => {
  const isEdit = !!post;
  const [form,   setForm]   = useState(isEdit ? {
    title:        post.title,
    excerpt:      post.excerpt || '',
    content:      post.content || '',
    thumbnail:    post.thumbnail || '',
    is_published: !!post.is_published,
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Vui lòng nhập tiêu đề'); return; }
    if (!form.content.trim()) { toast.error('Vui lòng nhập nội dung'); return; }
    setSaving(true);
    try {
      if (isEdit) { await adminAPI.updatePost(post.id, form); toast.success('Cập nhật thành công'); }
      else { await adminAPI.createPost(form); toast.success('Đăng bài thành công'); }
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-heading text-lg">{isEdit ? 'Sửa bài viết' : 'Viết bài mới'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-base font-medium text-gray-700 block mb-1.5">Tiêu đề *</label>
            <input name="title" value={form.title} onChange={handle} required
              className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500"
              placeholder="Tiêu đề bài viết" />
          </div>
          <div>
            <label className="text-base font-medium text-gray-700 block mb-1.5">Ảnh thumbnail (URL)</label>
            <input name="thumbnail" value={form.thumbnail} onChange={handle}
              className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500"
              placeholder="https://..." />
            {form.thumbnail && (
              <div className="mt-2 h-24 w-full rounded-sm overflow-hidden bg-gray-100">
                <img src={form.thumbnail} alt="preview" className="w-full h-full object-cover" onError={(e) => e.target.style.display='none'} />
              </div>
            )}
          </div>
          <div>
            <label className="text-base font-medium text-gray-700 block mb-1.5">Tóm tắt</label>
            <textarea name="excerpt" value={form.excerpt} onChange={handle} rows={2}
              className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500 resize-none"
              placeholder="Mô tả ngắn hiển thị trong danh sách bài viết" />
          </div>
          <div>
            <label className="text-base font-medium text-gray-700 block mb-1.5">Nội dung * (HTML hoặc text)</label>
            <textarea name="content" value={form.content} onChange={handle} rows={12} required
              className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500 resize-none font-mono"
              placeholder="<p>Nội dung bài viết...</p>" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" name="is_published" checked={form.is_published} onChange={handle} className="w-4 h-4 rounded" />
            <span className="text-base font-medium text-gray-700">Xuất bản ngay</span>
            <span className="text-xs text-gray-400">(bỏ tick = lưu nháp)</span>
          </label>
          <div className="flex gap-3 pt-2 border-t">
            <Button type="submit" variant="primary" loading={saving} className="flex-1">
              {isEdit ? 'Lưu thay đổi' : 'Đăng bài'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminBlog;
