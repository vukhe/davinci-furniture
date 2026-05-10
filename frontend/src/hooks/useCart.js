// ── useCart.js ────────────────────────────────────────
import { useDispatch, useSelector } from 'react-redux';
import {
  addToCart, removeCartItem, updateCartItem, clearCart,
  selectCartItems, selectCartCount, selectCartSubtotal,
} from '../store/slices/cartSlice';
import { toggleCart } from '../store/slices/uiSlice';

const useCart = () => {
  const dispatch  = useDispatch();
  const items     = useSelector(selectCartItems);
  const count     = useSelector(selectCartCount);
  const subtotal  = useSelector(selectCartSubtotal);

  return {
    items,
    count,
    subtotal,
    addItem:    (data) => dispatch(addToCart(data)),
    removeItem: (id)   => dispatch(removeCartItem(id)),
    updateItem: (id, qty) => dispatch(updateCartItem({ itemId: id, quantity: qty })),
    clear:      ()     => dispatch(clearCart()),
    openCart:   ()     => dispatch(toggleCart()),
  };
};

export default useCart;
