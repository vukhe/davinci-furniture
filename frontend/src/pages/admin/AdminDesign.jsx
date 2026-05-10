import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { formatDate } from '../../utils/format';
import { Spinner, Badge } from '../../components/common';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Chờ xử lý',    color: 'yellow' },
  { value: 'contacted', label: 'Đã liên hệ',   color: 'blue'   },
  { value: 'done',      label: 'Hoàn thành',    color: 'green'  },
];

const AdminDesign = () => {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getDesignRequests();
      setRequests(res.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = async (id, status) => {
    try {
      await adminAPI.updateDesignStatus(id, status);
      toast.success('Cập nhật trạng thái thành công');
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
    } catch (err) { toast.error(err.message); }
  };

  const filtered = filter ? requests.filter(r => r.status === filter) : requests;

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s.value] = requests.filter(r => r.status === s.value).length;
    return acc;
  }, {});

  return (
    <div className="p-8">
      <h1 className="font-heading text-2xl text-dark mb-6">Yêu cầu thiết kế nội thất</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {STATUS_OPTIONS.map(({ value, label, color }) => (
          <button
            key={value}
            onClick={() => setFilter(filter === value ? '' : value)}
            className={`bg-white rounded-lg border p-4 shadow-sm text-left transition-all hover:border-primary-300 ${
              filter === value ? 'border-primary-500 ring-1 ring-primary-200' : 'border-gray-100'
            }`}
          >
            <p className="font-heading text-2xl font-bold text-dark">{counts[value] || 0}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge color={color}>{label}</Badge>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* List */}
        <div className="flex-1 bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">Không có yêu cầu nào</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs border-b">
                <tr>
                  <th className="px-5 py-3.5 text-left">Khách hàng</th>
                  <th className="px-5 py-3.5 text-left">Liên hệ</th>
                  <th className="px-5 py-3.5 text-center">Trạng thái</th>
                  <th className="px-5 py-3.5 text-left">Ngày gửi</th>
                  <th className="px-5 py-3.5 text-center">Cập nhật</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((req) => {
                  const statusInfo = STATUS_OPTIONS.find(s => s.value === req.status);
                  return (
                    <tr
                      key={req.id}
                      onClick={() => setSelected(req)}
                      className={`cursor-pointer hover:bg-blue-50 transition-colors ${selected?.id === req.id ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-dark">{req.full_name}</p>
                        {req.user_id && <p className="text-xs text-primary-500">✓ Đã có tài khoản</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-gray-600">{req.phone}</p>
                        {req.email && <p className="text-xs text-gray-400">{req.email}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge color={statusInfo?.color || 'gray'}>{statusInfo?.label || req.status}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">{formatDate(req.created_at)}</td>
                      <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={req.status}
                          onChange={(e) => handleStatusChange(req.id, e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary-500"
                        >
                          {STATUS_OPTIONS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 bg-white rounded-lg border border-gray-100 shadow-sm p-5 sticky top-24 self-start space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base">Chi tiết yêu cầu</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Khách hàng</p>
                <p className="font-medium text-dark">{selected.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Điện thoại</p>
                <a href={`tel:${selected.phone}`} className="text-primary-500 hover:underline">{selected.phone}</a>
              </div>
              {selected.email && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Email</p>
                  <a href={`mailto:${selected.email}`} className="text-primary-500 hover:underline text-xs break-all">{selected.email}</a>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Ngày gửi</p>
                <p className="text-gray-600">{formatDate(selected.created_at)}</p>
              </div>
              {selected.description && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Mô tả yêu cầu</p>
                  <p className="text-gray-600 text-xs leading-relaxed bg-gray-50 rounded p-2.5">{selected.description}</p>
                </div>
              )}
              {selected.file_url && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">File đính kèm</p>
                  <a href={selected.file_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary-500 hover:underline flex items-center gap-1">
                    📎 Xem file
                  </a>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Cập nhật trạng thái</p>
              <div className="space-y-2">
                {STATUS_OPTIONS.map(({ value, label, color }) => (
                  <button
                    key={value}
                    onClick={() => handleStatusChange(selected.id, value)}
                    className={`w-full py-2 px-3 rounded-sm text-xs font-medium transition-colors text-left flex items-center justify-between ${
                      selected.status === value
                        ? 'bg-dark text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span>{label}</span>
                    {selected.status === value && <span>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t pt-3 flex gap-2">
              <a
                href={`tel:${selected.phone}`}
                className="flex-1 py-2 bg-primary-500 text-white text-xs font-medium text-center rounded-sm hover:bg-primary-600 transition-colors"
              >
                📞 Gọi ngay
              </a>
              {selected.email && (
                <a
                  href={`mailto:${selected.email}`}
                  className="flex-1 py-2 bg-dark text-white text-xs font-medium text-center rounded-sm hover:bg-dark-50 transition-colors"
                >
                  ✉️ Email
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDesign;
