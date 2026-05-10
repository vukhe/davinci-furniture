import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchWishlist, toggleWishlist } from '../store/slices/wishlistSlice';
import { addToCart } from '../store/slices/cartSlice';
import { openCart } from '../store/slices/uiSlice';
import { formatPrice } from '../utils/format';
import { Spinner, EmptyState, Breadcrumb, Button } from '../components/common';

const WishlistPage = () => {
  const dispatch = useDispatch();
  const { items } = useSelector((s) => s.wishlist);

  useEffect(() => { dispatch(fetchWishlist()); }, []);

  const handleAddCart = (item) => {
    dispatch(addToCart({ product_id: item.product_id, quantity: 1 }));
    dispatch(openCart());
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Yêu thích' }]} />
      <h1 className="font-heading text-3xl mb-8">Sản phẩm yêu thích ({items.length})</h1>

      {items.length === 0 ? (
        <EmptyState
          icon="💛"
          title="Chưa có sản phẩm yêu thích"
          description="Nhấn vào biểu tượng tim trên sản phẩm để thêm vào danh sách yêu thích"
          action={<Link to="/products"><Button variant="primary">Khám phá sản phẩm</Button></Link>}
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.product_id} className="group bg-white border border-gray-100 rounded-sm shadow-sm overflow-hidden">
              <div className="relative aspect-square overflow-hidden bg-gray-100">
                <Link to={`/products/${item.slug}`}>
                  <img
                    src={item.image || '/placeholder.jpg'}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </Link>
                <button
                  onClick={() => dispatch(toggleWishlist(item.product_id))}
                  className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                  title="Xóa khỏi yêu thích"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.318 6.318a4.5 4.5 0 0 1 6.364 0L12 7.636l1.318-1.318a4.5 4.5 0 1 1 6.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 0 1 0-6.364z" />
                  </svg>
                </button>
              </div>

              <div className="p-4">
                <Link to={`/products/${item.slug}`}>
                  <h3 className="font-heading text-sm text-dark hover:text-primary-600 transition-colors line-clamp-2 mb-2">
                    {item.name}
                  </h3>
                </Link>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-semibold text-dark">{formatPrice(item.sale_price || item.price)}</span>
                  {item.sale_price && (
                    <span className="text-xs text-gray-400 line-through">{formatPrice(item.price)}</span>
                  )}
                </div>
                <button
                  onClick={() => handleAddCart(item)}
                  className="w-full py-2 bg-dark text-white text-xs font-medium tracking-wider hover:bg-primary-500 transition-colors rounded-sm"
                >
                  Thêm vào giỏ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
