import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { formatPrice, formatDate } from '../../utils/format';
import { Button, Spinner, Badge } from '../../components/common';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  code: '', type: 'percent', value: '',
  min_order: '', max_discount: '', usage_limit: '',
  start_date: '', end_date: '',
};

const AdminVouchers = () => {
  const [vouchers, setVouchers] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getVouchers();
      setVouchers(res.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Vô hiệu hóa voucher "${code}"?`)) return;
    try {
      await adminAPI.deleteVoucher(id);
      toast.success('Đã vô hiệu hóa voucher');
      load();
    } catch (err) { toast.error(err.message); }
  };

  const isExpired = (v) => v.end_date && new Date(v.end_date) < new Date();
  const isUsedUp  = (v) => v.usage_limit && v.used_count >= v.usage_limit;

  const getStatus = (v) => {
    if (!v.is_active)  return { label: 'Vô hiệu', color: 'red' };
    if (isExpired(v))  return { label: 'Hết hạn', color: 'red' };
    if (isUsedUp(v))   return { label: 'Hết lượt', color: 'yellow' };
    return { label: 'Hoạt động', color: 'green' };
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-3xl text-dark">Quản lý Voucher</h1>
        <Button variant="primary" onClick={() => setShowForm(true)}>+ Tạo voucher mới</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Tổng voucher',   value: vouchers.length },
          { label: 'Đang hoạt động', value: vouchers.filter(v => v.is_active && !isExpired(v) && !isUsedUp(v)).length },
          { label: 'Đã hết hạn',     value: vouchers.filter(isExpired).length },
          { label: 'Đã dùng hết',    value: vouchers.filter(isUsedUp).length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm text-center">
            <p className="font-heading text-2xl font-bold text-dark">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : vouchers.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">Chưa có voucher nào</div>
        ) : (
          <table className="w-full text-base">
            <thead className="bg-gray-50 text-gray-500 text-sm border-b">
              <tr>
                <th className="px-5 py-4 text-left">Mã</th>
                <th className="px-5 py-4 text-center">Loại</th>
                <th className="px-5 py-4 text-center">Giá trị</th>
                <th className="px-5 py-4 text-right">Đơn tối thiểu</th>
                <th className="px-5 py-4 text-center">Đã dùng</th>
                <th className="px-5 py-4 text-center">Hạn dùng</th>
                <th className="px-5 py-4 text-center">Trạng thái</th>
                <th className="px-5 py-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vouchers.map((v) => {
                const status = getStatus(v);
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-dark bg-gray-100 px-2 py-0.5 rounded text-sm">
                        {v.code}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Badge color={v.type === 'percent' ? 'blue' : 'primary'}>
                        {v.type === 'percent' ? 'Phần trăm' : 'Số tiền'}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-center font-semibold text-primary-600">
                      {v.type === 'percent' ? `${v.value}%` : formatPrice(v.value)}
                      {v.max_discount && (
                        <p className="text-xs text-gray-400 font-normal">tối đa {formatPrice(v.max_discount)}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right text-gray-500">
                      {v.min_order > 0 ? formatPrice(v.min_order) : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-gray-600">{v.used_count}</span>
                      {v.usage_limit && (
                        <span className="text-gray-400">/{v.usage_limit}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center text-xs text-gray-400">
                      {v.end_date ? formatDate(v.end_date) : '∞'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Badge color={status.color}>{status.label}</Badge>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {v.is_active && (
                        <button onClick={() => handleDelete(v.id, v.code)}
                          className="text-xs text-red-500 hover:underline">
                          Vô hiệu
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <VoucherFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
};

const VoucherFormModal = ({ onClose, onSaved }) => {
  const [form,   setForm]   = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) { toast.error('Vui lòng nhập mã voucher'); return; }
    if (!form.value || parseFloat(form.value) <= 0) { toast.error('Giá trị không hợp lệ'); return; }
    if (form.type === 'percent' && parseFloat(form.value) > 100) { toast.error('Phần trăm không vượt quá 100%'); return; }
    setSaving(true);
    try {
      await adminAPI.createVoucher(form);
      toast.success('Tạo voucher thành công');
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-heading text-lg">Tạo voucher mới</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-base font-medium text-gray-700 block mb-1.5">Mã voucher *</label>
            <input name="code" value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
              required placeholder="VD: SUMMER20"
              className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:border-primary-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-base font-medium text-gray-700 block mb-1.5">Loại giảm giá *</label>
              <select name="type" value={form.type} onChange={handle}
                className="w-full border border-gray-200 rounded-sm px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary-500">
                <option value="percent">Phần trăm (%)</option>
                <option value="fixed">Số tiền cố định (đ)</option>
              </select>
            </div>
            <div>
              <label className="text-base font-medium text-gray-700 block mb-1.5">
                Giá trị * {form.type === 'percent' ? '(%)' : '(đ)'}
              </label>
              <input name="value" value={form.value} onChange={handle} required type="number" min="1"
                max={form.type === 'percent' ? '100' : undefined}
                placeholder={form.type === 'percent' ? 'VD: 20' : 'VD: 50000'}
                className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-base font-medium text-gray-700 block mb-1.5">Đơn tối thiểu (đ)</label>
              <input name="min_order" value={form.min_order} onChange={handle} type="number" min="0"
                placeholder="0 = không giới hạn"
                className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="text-base font-medium text-gray-700 block mb-1.5">Giảm tối đa (đ)</label>
              <input name="max_discount" value={form.max_discount} onChange={handle} type="number" min="0"
                placeholder="Để trống = không giới hạn"
                className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500" />
            </div>
          </div>

          <div>
            <label className="text-base font-medium text-gray-700 block mb-1.5">Giới hạn số lần dùng</label>
            <input name="usage_limit" value={form.usage_limit} onChange={handle} type="number" min="1"
              placeholder="Để trống = không giới hạn"
              className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-base font-medium text-gray-700 block mb-1.5">Ngày bắt đầu</label>
              <input name="start_date" value={form.start_date} onChange={handle} type="datetime-local"
                className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="text-base font-medium text-gray-700 block mb-1.5">Ngày hết hạn</label>
              <input name="end_date" value={form.end_date} onChange={handle} type="datetime-local"
                className="w-full border border-gray-200 rounded-sm px-4 py-2.5 text-sm focus:outline-none focus:border-primary-500" />
            </div>
          </div>

          {/* Preview */}
          {form.code && form.value && (
            <div className="bg-primary-50 border border-primary-100 rounded-sm p-3 text-sm text-primary-700">
              <p className="font-medium">Xem trước:</p>
              <p>Mã <span className="font-mono font-bold">{form.code}</span> giảm{' '}
                <strong>{form.type === 'percent' ? `${form.value}%` : formatPrice(form.value)}</strong>
                {form.min_order ? ` cho đơn từ ${formatPrice(form.min_order)}` : ''}
                {form.usage_limit ? `, tối đa ${form.usage_limit} lần dùng` : ''}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t">
            <Button type="submit" variant="primary" loading={saving} className="flex-1">Tạo voucher</Button>
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminVouchers;
