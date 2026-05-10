import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { closeCart } from '../../store/slices/uiSlice';
import { removeCartItem, updateCartItem, selectCartItems, selectCartSubtotal } from '../../store/slices/cartSlice';
import { formatPrice } from '../../utils/format';

const CartDrawer = () => {
  const dispatch  = useDispatch();
  const isOpen    = useSelector((s) => s.ui.cartOpen);
  const items     = useSelector(selectCartItems);
  const subtotal  = useSelector(selectCartSubtotal);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => dispatch(closeCart())}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b">
              <h2 className="font-heading text-xl">Giỏ hàng ({items.length})</h2>
              <button onClick={() => dispatch(closeCart())} className="p-2 hover:text-primary-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-400">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                      d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <p className="font-heading text-lg">Giỏ hàng trống</p>
                  <Link
                    to="/products"
                    onClick={() => dispatch(closeCart())}
                    className="text-sm text-primary-500 hover:underline"
                  >
                    Tiếp tục mua sắm →
                  </Link>
                </div>
              ) : (
                items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex gap-4"
                  >
                    <div className="w-20 h-20 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                      <img src={item.image || '/placeholder.jpg'} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading text-sm font-medium line-clamp-2 mb-1">{item.name}</p>
                      <p className="text-primary-600 font-semibold text-sm">{formatPrice(item.price)}</p>
                      {item.color && <p className="text-xs text-gray-400 mt-0.5">Màu: {item.color}</p>}

                      <div className="flex items-center justify-between mt-2">
                        {/* Quantity */}
                        <div className="flex items-center border border-gray-200 rounded">
                          <button
                            onClick={() => item.quantity > 1
                              ? dispatch(updateCartItem({ itemId: item.id, quantity: item.quantity - 1 }))
                              : dispatch(removeCartItem(item.id))
                            }
                            className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 transition-colors text-lg"
                          >−</button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            onClick={() => dispatch(updateCartItem({ itemId: item.id, quantity: item.quantity + 1 }))}
                            className="w-7 h-7 flex items-center justify-center hover:bg-gray-50 transition-colors text-lg"
                          >+</button>
                        </div>

                        <button
                          onClick={() => dispatch(removeCartItem(item.id))}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                        >Xóa</button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t px-6 py-5 bg-gray-50 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Tạm tính</span>
                  <span className="font-heading text-lg font-semibold">{formatPrice(subtotal)}</span>
                </div>
                <p className="text-xs text-gray-400">Phí vận chuyển & mã giảm giá tính ở bước thanh toán</p>
                <Link
                  to="/checkout"
                  onClick={() => dispatch(closeCart())}
                  className="block w-full py-3.5 bg-dark text-white text-center text-sm font-medium tracking-widest hover:bg-primary-500 transition-colors duration-300 rounded-sm"
                >
                  THANH TOÁN NGAY
                </Link>
                <Link
                  to="/cart"
                  onClick={() => dispatch(closeCart())}
                  className="block w-full py-3 border border-dark text-center text-sm tracking-widest hover:bg-gray-50 transition-colors rounded-sm"
                >
                  XEM GIỎ HÀNG
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
