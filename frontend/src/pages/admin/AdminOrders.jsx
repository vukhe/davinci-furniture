import { useEffect, useState } from 'react';
import { adminAPI } from '../../services/api';
import { formatPrice, formatDate } from '../../utils/format';
import { Spinner, StatusBadge, Button } from '../../components/common';
import toast from 'react-hot-toast';

const ORDER_STATUSES = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'];

const AdminOrders = () => {
  const [orders,   setOrders]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [pagination, setPagination] = useState({});
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getOrders({ page, limit: 15, status: filterStatus || undefined });
      setOrders(res.data);
      setPagination(res.pagination || {});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, filterStatus]);

  const handleStatusChange = async (orderId, status) => {
    try {
      await adminAPI.updateOrderStatus(orderId, status);
      toast.success('Cập nhật trạng thái thành công');
      load();
      if (selected?.id === orderId) setSelected({ ...selected, status });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="p-8">
      <h1 className="font-heading text-3xl text-dark mb-6">Quản lý đơn hàng</h1>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['', ...ORDER_STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => { setFilterStatus(s); setPage(1); }}
            className={`px-4 py-2 text-xs rounded-full border transition-colors ${
              filterStatus === s ? 'bg-dark text-white border-dark' : 'border-gray-200 text-gray-500 hover:border-dark hover:text-dark'
            }`}
          >
            {s === '' ? 'Tất cả' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : (
            <table className="w-full text-base">
              <thead className="bg-gray-50 text-gray-500 text-sm border-b">
                <tr>
                  <th className="px-5 py-4 text-left">Mã đơn</th>
                  <th className="px-5 py-4 text-left">Khách hàng</th>
                  <th className="px-5 py-4 text-right">Tổng tiền</th>
                  <th className="px-5 py-4 text-center">Thanh toán</th>
                  <th className="px-5 py-4 text-center">Trạng thái</th>
                  <th className="px-5 py-4 text-left">Ngày đặt</th>
                  <th className="px-5 py-4 text-center">Cập nhật</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o)}
                    className={`cursor-pointer hover:bg-blue-50 transition-colors ${selected?.id === o.id ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-5 py-4 font-medium text-primary-600">{o.order_code}</td>
                    <td className="px-5 py-4 text-gray-600">{o.customer_name || o.shipping_name}</td>
                    <td className="px-5 py-4 text-right font-semibold">{formatPrice(o.total)}</td>
                    <td className="px-5 py-4 text-center">
                      <StatusBadge status={o.payment_status} />
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{formatDate(o.created_at)}</td>
                    <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={o.status}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary-500"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Order Detail Panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 bg-white rounded-lg border border-gray-100 shadow-sm p-5 space-y-4 sticky top-24 self-start">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg">Chi tiết đơn hàng</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Mã đơn:</span><span className="font-medium">{selected.order_code}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Khách:</span><span>{selected.shipping_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">SĐT:</span><span>{selected.shipping_phone}</span></div>
              <div className="text-gray-400">Địa chỉ:</div>
              <div className="text-xs bg-gray-50 rounded p-2">{selected.shipping_addr}</div>
              <div className="flex justify-between"><span className="text-gray-400">Thanh toán:</span><span>{PAYMENT_LABEL[selected.payment_method]}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Tổng tiền:</span><span className="font-semibold text-primary-600">{formatPrice(selected.total)}</span></div>
              {selected.note && (
                <div><span className="text-gray-400">Ghi chú:</span><p className="text-xs mt-1 bg-gray-50 rounded p-2">{selected.note}</p></div>
              )}
            </div>
          </div>
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
    </div>
  );
};

const STATUS_LABEL = {
  pending:   'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping:  'Đang giao',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const PAYMENT_LABEL = {
  cod:   'COD',
  vnpay: 'VNPay',
  momo:  'MoMo',
};

export default AdminOrders;
