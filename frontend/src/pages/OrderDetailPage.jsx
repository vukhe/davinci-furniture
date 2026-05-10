import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { orderAPI } from '../services/api';
import { formatPrice, formatDate } from '../utils/format';
import { Spinner, StatusBadge, Breadcrumb } from '../components/common';

const STEPS = ['pending', 'confirmed', 'shipping', 'completed'];
const STEP_LABELS = { pending: 'Đặt hàng', confirmed: 'Xác nhận', shipping: 'Đang giao', completed: 'Hoàn thành' };

const OrderDetailPage = () => {
  const { id }            = useParams();
  const [searchParams]    = useSearchParams();
  const [order,  setOrder]  = useState(null);
  const [loading, setLoading] = useState(true);
  const isSuccess = searchParams.get('success') === '1';

  useEffect(() => {
    orderAPI.getById(id)
      .then((res) => setOrder(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  if (!order)  return <div className="text-center py-20 text-gray-400">Không tìm thấy đơn hàng</div>;

  const currentStep = STEPS.indexOf(order.status);

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Đơn hàng', to: '/orders' }, { label: order.order_code }]} />

      {/* Success banner */}
      {isSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-sm p-5 mb-6 text-center"
        >
          <p className="text-2xl mb-1">🎉</p>
          <p className="font-heading text-lg text-green-700">Đặt hàng thành công!</p>
          <p className="text-sm text-green-600 mt-1">Cảm ơn bạn đã mua sắm tại DaVinci Furniture. Chúng tôi sẽ xác nhận đơn hàng sớm nhất.</p>
        </motion.div>
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-heading text-2xl">Đơn hàng #{order.order_code}</h1>
        <StatusBadge status={order.status} />
      </div>

      {/* Progress */}
      {order.status !== 'cancelled' && (
        <div className="bg-white border border-gray-100 rounded-sm p-6 mb-5 shadow-sm">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 z-0">
              <div
                className="h-full bg-primary-500 transition-all duration-500"
                style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
            {STEPS.map((step, i) => (
              <div key={step} className="flex flex-col items-center gap-2 z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i <= currentStep ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {i < currentStep ? '✓' : i + 1}
                </div>
                <span className={`text-xs whitespace-nowrap ${i <= currentStep ? 'text-dark font-medium' : 'text-gray-400'}`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Shipping info */}
        <div className="bg-white border border-gray-100 rounded-sm p-5 shadow-sm">
          <h3 className="font-heading text-base mb-3">Thông tin giao hàng</h3>
          <div className="space-y-1 text-sm text-gray-600">
            <p className="font-medium text-dark">{order.shipping_name}</p>
            <p>{order.shipping_phone}</p>
            <p className="text-gray-400 text-xs mt-2">{order.shipping_addr}</p>
          </div>
        </div>

        {/* Payment info */}
        <div className="bg-white border border-gray-100 rounded-sm p-5 shadow-sm">
          <h3 className="font-heading text-base mb-3">Thanh toán</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Phương thức</span>
              <span className="capitalize font-medium text-dark">{order.payment_method?.toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Trạng thái</span>
              <StatusBadge status={order.payment_status} />
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Ngày đặt</span>
              <span>{formatDate(order.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Order items */}
      <div className="bg-white border border-gray-100 rounded-sm shadow-sm mb-5">
        <h3 className="font-heading text-base px-5 py-4 border-b">Sản phẩm đã đặt</h3>
        <div className="divide-y">
          {(order.items || []).map((item) => (
            <div key={item.id} className="flex gap-4 p-5">
              <div className="w-16 h-16 rounded-sm bg-gray-100 overflow-hidden flex-shrink-0">
                <img src={item.image || '/placeholder.jpg'} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-dark line-clamp-2">{item.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">x{item.quantity}</p>
              </div>
              <p className="font-semibold text-sm flex-shrink-0">{formatPrice(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t px-5 py-4 space-y-2 bg-gray-50 rounded-b-sm">
          <div className="flex justify-between text-sm text-gray-500">
            <span>Tạm tính</span><span>{formatPrice(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Giảm giá</span><span>-{formatPrice(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-500">
            <span>Phí vận chuyển</span>
            <span>{order.shipping_fee === 0 ? <span className="text-green-500">Miễn phí</span> : formatPrice(order.shipping_fee)}</span>
          </div>
          <div className="flex justify-between font-semibold text-base pt-2 border-t">
            <span>Tổng cộng</span>
            <span className="font-heading text-xl text-dark">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      {order.note && (
        <div className="bg-amber-50 border border-amber-100 rounded-sm p-4 text-sm text-gray-600">
          <span className="font-medium">Ghi chú: </span>{order.note}
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Link to="/orders" className="text-sm text-gray-400 hover:text-dark transition-colors">
          ← Về danh sách đơn hàng
        </Link>
      </div>
    </div>
  );
};

export default OrderDetailPage;
