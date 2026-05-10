import { useEffect, useRef, useState } from 'react';
import { adminAPI } from '../../services/api';
import { formatPrice } from '../../utils/format';
import { Button, Spinner, Badge } from '../../components/common';
import toast from 'react-hot-toast';

const AdminProducts = () => {
  const [products, setProducts]     = useState([]);
  const [loading,  setLoading]      = useState(true);
  const [search,   setSearch]       = useState('');
  const [page,     setPage]         = useState(1);
  const [pagination, setPagination] = useState({});
  const [showForm, setShowForm]     = useState(false);
  const [editing,  setEditing]      = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getProducts({ page, limit: 15, search: search || undefined });
      setProducts(res.data);
      setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Xóa sản phẩm "${name}"?`)) return;
    await adminAPI.deleteProduct(id);
    toast.success('Đã xóa sản phẩm');
    load();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl text-dark">Quản lý sản phẩm</h1>
        <Button variant="primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          + Thêm sản phẩm
        </Button>
      </div>

      <div className="mb-5">
        <input
          type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Tìm kiếm sản phẩm..."
          className="border border-gray-200 rounded-sm px-4 py-2.5 text-sm w-72 focus:outline-none focus:border-primary-500"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : (
          <table className="w-full text-base">
            <thead className="bg-gray-50 text-gray-500 text-sm border-b">
              <tr>
                <th className="px-5 py-4 text-left">Sản phẩm</th>
                <th className="px-5 py-4 text-left">Danh mục</th>
                <th className="px-5 py-4 text-right">Giá</th>
                <th className="px-5 py-4 text-center">Tồn kho</th>
                <th className="px-5 py-4 text-center">Đã bán</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                        <img src={p.image || '/placeholder.jpg'} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-medium text-dark max-w-xs truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">#{p.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{p.category_name}</td>
                  <td className="px-5 py-4 text-right">
                    <div>
                      <p className="font-medium">{formatPrice(p.sale_price || p.price)}</p>
                      {p.sale_price && <p className="text-xs text-gray-400 line-through">{formatPrice(p.price)}</p>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={p.stock === 0 ? 'text-red-500 font-semibold' : 'text-gray-700'}>{p.stock}</span>
                  </td>
                  <td className="px-5 py-4 text-center text-gray-500">{p.sold}</td>
                  <td className="px-5 py-4 text-center">
                    <Badge color={p.is_active ? 'green' : 'red'}>{p.is_active ? 'Hiện' : 'Ẩn'}</Badge>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setEditing(p); setShowForm(true); }}
                        className="text-xs text-blue-500 hover:underline">Sửa</button>
                      <button onClick={() => handleDelete(p.id, p.name)}
                        className="text-xs text-red-500 hover:underline">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={7} className="text-center py-16 text-gray-400">Không có sản phẩm nào</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pagination.pages > 1 && (
        <div className="flex justify-center mt-6 gap-2">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-9 h-9 text-sm rounded-sm ${p === page ? 'bg-dark text-white' : 'border border-gray-200 hover:border-dark'}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <ProductFormModal
          product={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
};

// ── Image Upload Component ────────────────────────────────────────────────────
const ImageUploader = ({ images, onChange }) => {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await adminAPI.uploadImage(file);
      onChange([...images, { url: res.url, public_id: res.public_id }]);
      toast.success('Upload ảnh thành công');
    } catch {
      toast.error('Upload thất bại');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (idx) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1.5">Ảnh sản phẩm</label>
      {/* Preview grid */}
      <div className="flex flex-wrap gap-2 mb-3">
        {images.map((img, idx) => (
          <div key={idx} className="relative w-20 h-20 rounded border border-gray-200 overflow-hidden group">
            <img src={img.url} alt="" className="w-full h-full object-cover" />
            {idx === 0 && (
              <span className="absolute top-0 left-0 bg-primary-500 text-white text-[10px] px-1">Chính</span>
            )}
            <button
              type="button"
              onClick={() => removeImage(idx)}
              className="absolute inset-0 bg-black/50 text-white text-lg hidden group-hover:flex items-center justify-center"
            >✕</button>
          </div>
        ))}

        {/* Upload button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Spinner size="sm" />
          ) : (
            <>
              <span className="text-2xl leading-none">+</span>
              <span className="text-[10px] mt-0.5">Upload</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <p className="text-xs text-gray-400">Ảnh đầu tiên là ảnh chính. Tối đa 10MB/ảnh.</p>
    </div>
  );
};

// ── Product Form Modal ────────────────────────────────────────────────────────
const INIT_FORM = {
  name: '', category_id: '', brand: '', material: '',
  width_cm: '', depth_cm: '', height_cm: '',
  price: '', sale_price: '', stock: 0,
  description: '', is_featured: false, is_active: true,
};

const Field = ({ label, children }) => (
  <div>
    <label className="text-sm font-medium text-gray-700 block mb-1.5">{label}</label>
    {children}
  </div>
);

const TextInput = ({ name, value, onChange, type = 'text', placeholder = '', required = false, className = '' }) => (
  <input
    name={name} value={value} onChange={onChange}
    type={type} placeholder={placeholder} required={required}
    className={`w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500 ${className}`}
  />
);

const ProductFormModal = ({ product, onClose, onSaved }) => {
  const isEdit = !!product;
  const [form,    setForm]    = useState({ ...INIT_FORM, ...product });
  const [images,  setImages]  = useState([]);
  const [saving,  setSaving]  = useState(false);

  const handle = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!form.name.trim())       return toast.error('Vui lòng nhập tên sản phẩm');
    if (!form.category_id)       return toast.error('Vui lòng nhập ID danh mục');
    if (!form.price || form.price <= 0) return toast.error('Giá gốc không hợp lệ');
    if (form.sale_price && Number(form.sale_price) >= Number(form.price))
      return toast.error('Giá khuyến mãi phải nhỏ hơn giá gốc');

    setSaving(true);
    try {
      const payload = {
        ...form,
        images: images.length ? images : undefined,
      };
      if (isEdit) {
        await adminAPI.updateProduct(product.id, payload);
        toast.success('Cập nhật thành công');
      } else {
        await adminAPI.createProduct(payload);
        toast.success('Thêm sản phẩm thành công');
      }
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="font-heading text-lg">{isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* ── Ảnh ── */}
          <ImageUploader images={images} onChange={setImages} />

          {/* ── Thông tin cơ bản ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Thông tin cơ bản</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Tên sản phẩm *">
                  <input name="name" value={form.name} onChange={handle} required className={inputCls}
                    placeholder="VD: Sofa Da Thật Cao Cấp Milano" />
                </Field>
              </div>
              <Field label="ID Danh mục *">
                <input name="category_id" value={form.category_id} onChange={handle} required type="number" className={inputCls} />
              </Field>
              <Field label="Thương hiệu">
                <input name="brand" value={form.brand} onChange={handle} className={inputCls} placeholder="DaVinci" />
              </Field>
              <div className="col-span-2">
                <Field label="Chất liệu">
                  <input name="material" value={form.material} onChange={handle} className={inputCls}
                    placeholder="VD: Gỗ sồi / Da thật" />
                </Field>
              </div>
            </div>
          </div>

          {/* ── Kích thước ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Kích thước (cm)</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Rộng (W)">
                <input name="width_cm" value={form.width_cm} onChange={handle} type="number" min="0" step="0.1"
                  className={inputCls} placeholder="0" />
              </Field>
              <Field label="Sâu (D)">
                <input name="depth_cm" value={form.depth_cm} onChange={handle} type="number" min="0" step="0.1"
                  className={inputCls} placeholder="0" />
              </Field>
              <Field label="Cao (H)">
                <input name="height_cm" value={form.height_cm} onChange={handle} type="number" min="0" step="0.1"
                  className={inputCls} placeholder="0" />
              </Field>
            </div>
          </div>

          {/* ── Giá & Kho ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Giá & Kho hàng</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Giá gốc (VNĐ) *">
                <input name="price" value={form.price} onChange={handle} required type="number" min="0"
                  className={inputCls} />
              </Field>
              <Field label="Giá khuyến mãi">
                <input name="sale_price" value={form.sale_price} onChange={handle} type="number" min="0"
                  className={inputCls} placeholder="Để trống nếu không giảm" />
              </Field>
              <Field label="Tồn kho">
                <input name="stock" value={form.stock} onChange={handle} type="number" min="0"
                  className={inputCls} />
              </Field>
            </div>
          </div>

          {/* ── Mô tả ── */}
          <Field label="Mô tả sản phẩm">
            <textarea name="description" value={form.description} onChange={handle} rows={5}
              className={`${inputCls} resize-none`}
              placeholder="Mô tả chi tiết về sản phẩm, chất liệu, tính năng..." />
          </Field>

          {/* ── Flags ── */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" name="is_featured" checked={form.is_featured} onChange={handle}
                className="rounded w-4 h-4 accent-amber-500" />
              <span>Sản phẩm nổi bật</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={handle}
                className="rounded w-4 h-4 accent-green-500" />
              <span>Hiển thị trên web</span>
            </label>
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2 border-t">
            <Button type="submit" variant="primary" loading={saving} className="flex-1">
              {isEdit ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminProducts;
