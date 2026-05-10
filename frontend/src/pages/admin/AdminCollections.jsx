import { useEffect, useState } from 'react';
import { Button, Spinner } from '../../components/common';
import toast from 'react-hot-toast';

const AdminCollections = () => {
  const [collections, setCollections] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [form, setForm] = useState({ name: '', description: '', banner_image: '', sort_order: 0 });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/collections');
      setCollections(res.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Vui lòng nhập tên bộ sưu tập'); return; }
    setSaving(true);
    try {
      await api.post('/admin/collections', form);
      toast.success('Tạo bộ sưu tập thành công');
      setShowForm(false);
      setForm({ name: '', description: '', banner_image: '', sort_order: 0 });
      load();
    } catch (err) { toast.error(err.message || 'Lỗi'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Xóa bộ sưu tập "${name}"?`)) return;
    try {
      await api.delete(`/admin/collections/${id}`);
      toast.success('Đã xóa');
      load();
    } catch (err) { toast.error(err.message || 'Lỗi'); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl text-dark">Bộ sưu tập</h1>
        <Button variant="primary" onClick={() => setShowForm(true)}>+ Tạo bộ sưu tập</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg"/></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {collections.map(col => (
            <div key={col.id} className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden">
              {col.banner_image && (
                <div className="h-40 overflow-hidden bg-gray-100">
                  <img src={col.banner_image} alt={col.name} className="w-full h-full object-cover"/>
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-heading text-xl text-dark">{col.name}</h3>
                    <p className="text-base text-gray-400 mt-0.5">{col.product_count} sản phẩm</p>
                    {col.description && <p className="text-base text-gray-500 mt-2 line-clamp-2">{col.description}</p>}
                  </div>
                  <button onClick={() => handleDelete(col.id, col.name)}
                    className="text-base text-red-400 hover:text-red-600 transition-colors flex-shrink-0 ml-3">
                    Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-heading text-xl">Tạo bộ sưu tập mới</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {[
                { label: 'Tên bộ sưu tập *', key: 'name',         placeholder: 'Gỗ óc chó sang trọng' },
                { label: 'Ảnh banner (URL)', key: 'banner_image', placeholder: 'https://...' },
                { label: 'Thứ tự hiển thị',  key: 'sort_order',   placeholder: '1', type: 'number' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="text-base font-medium text-gray-700 block mb-1.5">{label}</label>
                  <input type={type || 'text'} value={form[key]} placeholder={placeholder}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-base focus:outline-none focus:border-primary-500" />
                </div>
              ))}
              <div>
                <label className="text-base font-medium text-gray-700 block mb-1.5">Mô tả</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3} placeholder="Mô tả ngắn về bộ sưu tập..."
                  className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-base focus:outline-none focus:border-primary-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" variant="primary" loading={saving} className="flex-1">Tạo ngay</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Hủy</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCollections;
