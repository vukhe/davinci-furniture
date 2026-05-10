import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderAPI } from '../services/api';
import { formatPrice, formatDate } from '../utils/format';
import { Spinner, EmptyState, StatusBadge, Breadcrumb } from '../components/common';

const TABS = [
  { key: '',          label: 'Tất cả' },
  { key: 'pending',   label: 'Chờ xác nhận' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'shipping',  label: 'Đang giao' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' },
];

const OrdersPage = () => {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [status,  setStatus]  = useState('');

  useEffect(() => {
    setLoading(true);
    orderAPI.getMyAll({ status: status || undefined, limit: 20 })
      .then((res) => setOrders(res.data || []))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Đơn hàng của tôi' }]} />
      <h1 className="font-heading text-3xl mb-6">Đơn hàng của tôi</h1>

      {/* Status tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            className={`px-4 py-2 text-xs whitespace-nowrap rounded-full border transition-colors flex-shrink-0 ${
              status === key
                ? 'bg-dark text-white border-dark'
                : 'border-gray-200 text-gray-500 hover:border-dark hover:text-dark'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon="📦"
          title="Chưa có đơn hàng nào"
          description="Hãy mua sắm và đặt hàng để xem lịch sử tại đây"
          action={<Link to="/products" className="text-primary-500 hover:underline text-sm">Mua sắm ngay →</Link>}
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="block bg-white border border-gray-100 rounded-sm p-5 shadow-sm hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-dark">{order.order_code}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                  <p className="text-xs text-gray-400">{order.item_count} sản phẩm</p>
                </div>
                <div className="text-right">
                  <p className="font-heading text-xl font-semibold text-dark">{formatPrice(order.total)}</p>
                  <p className="text-xs text-gray-400 mt-1 capitalize">{order.payment_method}</p>
                </div>
              </div>

              {order.first_image && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="w-12 h-12 rounded-sm bg-gray-100 overflow-hidden">
                    <img src={order.first_image} alt="" className="w-full h-full object-cover" />
                  </div>
                  {order.item_count > 1 && (
                    <span className="text-xs text-gray-400">+{order.item_count - 1} sản phẩm khác</span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
