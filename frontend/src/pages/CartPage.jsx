import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  removeCartItem, updateCartItem, clearCart,
  selectCartItems, selectCartSubtotal,
} from '../store/slices/cartSlice';
import { formatPrice } from '../utils/format';
import { Button, EmptyState, Breadcrumb } from '../components/common';
import CoPurchaseSection from '../components/ai/CoPurchaseSection';

const CartPage = () => {
  const dispatch = useDispatch();
  const items    = useSelector(selectCartItems);
  const subtotal = useSelector(selectCartSubtotal);
  const shipping = subtotal >= 5000000 ? 0 : 50000;
  const total    = subtotal + shipping;

  return (
    <div className="container mx-auto px-4 py-10">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Giỏ hàng' }]} />
      <h1 className="font-heading text-3xl mb-8">Giỏ hàng ({items.length})</h1>

      {items.length === 0 ? (
        <EmptyState
          icon="🛒"
          title="Giỏ hàng của bạn đang trống"
          description="Hãy khám phá các sản phẩm nội thất cao cấp của chúng tôi"
          action={<Link to="/products"><Button variant="primary">Mua sắm ngay</Button></Link>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => dispatch(clearCart())}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors"
              >
                Xóa tất cả
              </button>
            </div>

            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex gap-5 bg-white border border-gray-100 rounded-sm p-4 shadow-sm"
                >
                  <div className="w-24 h-24 rounded-sm bg-gray-100 overflow-hidden flex-shrink-0">
                    <img src={item.image || '/placeholder.jpg'} alt={item.name} className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link to={`/products/${item.slug || '#'}`}>
                      <h3 className="font-heading text-base text-dark hover:text-primary-600 transition-colors line-clamp-2">
                        {item.name}
                      </h3>
                    </Link>
                    {item.color && <p className="text-xs text-gray-400 mt-1">Màu: {item.color}</p>}
                    {item.size  && <p className="text-xs text-gray-400">Size: {item.size}</p>}

                    <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
                      {/* Quantity */}
                      <div className="flex items-center border border-gray-200 rounded-sm">
                        <button
                          onClick={() => item.quantity > 1
                            ? dispatch(updateCartItem({ itemId: item.id, quantity: item.quantity - 1 }))
                            : dispatch(removeCartItem(item.id))
                          }
                          className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 text-lg"
                        >−</button>
                        <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => dispatch(updateCartItem({ itemId: item.id, quantity: item.quantity + 1 }))}
                          className="w-9 h-9 flex items-center justify-center hover:bg-gray-50 text-lg"
                        >+</button>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-heading text-lg font-semibold">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                        <button
                          onClick={() => dispatch(removeCartItem(item.id))}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-100 rounded-sm p-6 shadow-sm sticky top-24 space-y-4">
              <h2 className="font-heading text-lg">Tóm tắt đơn hàng</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Tạm tính ({items.length} sản phẩm)</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Phí vận chuyển</span>
                  <span>{shipping === 0 ? <span className="text-green-500">Miễn phí</span> : formatPrice(shipping)}</span>
                </div>
                {shipping > 0 && (
                  <p className="text-xs text-gray-400 italic">
                    Mua thêm {formatPrice(5000000 - subtotal)} để được miễn phí vận chuyển
                  </p>
                )}
              </div>
              <hr />
              <div className="flex justify-between font-semibold">
                <span>Tổng cộng</span>
                <span className="font-heading text-xl">{formatPrice(total)}</span>
              </div>
              <Link to="/checkout">
                <Button variant="primary" size="lg" className="w-full">TIẾN HÀNH THANH TOÁN</Button>
              </Link>
              <Link to="/products" className="block text-center text-sm text-gray-400 hover:text-dark transition-colors">
                ← Tiếp tục mua sắm
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* AI: Gợi ý dựa trên giỏ hàng */}
      {items.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <CoPurchaseSection
            cartProductIds={items.map(i => i.product_id).filter(Boolean)}
            limit={6}
          />
        </div>
      )}
    </div>
  );
};

export default CartPage;
