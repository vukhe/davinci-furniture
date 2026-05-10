import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { toggleWishlist } from '../../store/slices/wishlistSlice';
import { addToCart } from '../../store/slices/cartSlice';
import { openCart } from '../../store/slices/uiSlice';
import { selectIsWishlisted } from '../../store/slices/wishlistSlice';
import { formatPrice } from '../../utils/format';

const ProductCard = ({ product, index = 0 }) => {
  const dispatch    = useDispatch();
  const isWished    = useSelector(selectIsWishlisted(product.id));
  const { token }   = useSelector((s) => s.auth);

  const discount = product.sale_price
    ? Math.round((1 - product.sale_price / product.price) * 100)
    : 0;

  const handleAddCart = (e) => {
    e.preventDefault();
    dispatch(addToCart({ product_id: product.id, quantity: 1 }));
    dispatch(openCart());
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    if (!token) { window.location.href = '/login'; return; }
    dispatch(toggleWishlist(product.id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
    >
      <Link
        to={`/products/${product.slug}`}
        target="_blank"
        rel="noreferrer"
        className="group block"
      >
        {/* Image */}
        <div className="relative overflow-hidden rounded-sm bg-gray-100 aspect-[4/5]">
          <img
            src={product.image || '/placeholder.jpg'}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {discount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded">-{discount}%</span>
            )}
            {product.is_featured && (
              <span className="bg-primary-500 text-white text-xs font-bold px-2 py-0.5 rounded">Nổi bật</span>
            )}
            {product.stock === 0 && (
              <span className="bg-gray-600 text-white text-xs px-2 py-0.5 rounded">Hết hàng</span>
            )}
          </div>

          {/* Wishlist */}
          <button
            onClick={handleWishlist}
            className={`absolute top-3 right-3 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center
              transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110 ${
              isWished ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
            }`}
          >
            <svg className="w-4 h-4" fill={isWished ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4.318 6.318a4.5 4.5 0 0 1 6.364 0L12 7.636l1.318-1.318a4.5 4.5 0 1 1 6.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 0 1 0-6.364z" />
            </svg>
          </button>

          {/* Add to cart overlay */}
          <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <button
              onClick={handleAddCart}
              disabled={product.stock === 0}
              className="w-full py-3 bg-dark/90 text-white text-sm font-medium tracking-wider hover:bg-primary-500 transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {product.stock === 0 ? 'Hết hàng' : 'Thêm vào giỏ'}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="pt-3 pb-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{product.category_name}</p>
          <h3 className="font-heading text-base text-dark group-hover:text-primary-600 transition-colors line-clamp-2 leading-snug mb-2">
            {product.name}
          </h3>

          {/* Rating */}
          {product.avg_rating > 0 && (
            <div className="flex items-center gap-1 mb-2">
              {[1,2,3,4,5].map((s) => (
                <svg key={s} className={`w-3 h-3 ${s <= Math.round(product.avg_rating) ? 'text-yellow-400' : 'text-gray-200'}`}
                  fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-xs text-gray-400">({product.review_count})</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-lg font-semibold text-dark">
              {formatPrice(product.sale_price || product.price)}
            </span>
            {product.sale_price && (
              <span className="text-sm text-gray-400 line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

export default ProductCard;
