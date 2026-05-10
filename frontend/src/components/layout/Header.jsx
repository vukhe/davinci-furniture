import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { toggleCart, openMobileMenu, closeMobileMenu } from '../../store/slices/uiSlice';
import { logout } from '../../store/slices/authSlice';
import { selectCartCount } from '../../store/slices/cartSlice';
import SemanticSearchBar from '../ai/SemanticSearchBar';
import ImageSearchModal from '../ai/ImageSearchModal';

const NAV_LINKS = [
  { label: 'Trang chủ',  to: '/' },
  { label: 'Sản phẩm',   to: '/products' },
  { label: 'Bộ sưu tập', to: '/collections' },
  { label: 'Blog',        to: '/blog' },
  { label: 'Liên hệ',    to: '/contact' },
];

const Header = () => {
  const dispatch   = useDispatch();
  const cartCount  = useSelector(selectCartCount);
  const { user }   = useSelector((s) => s.auth);
  const { mobileMenuOpen } = useSelector((s) => s.ui);
  const [scrolled, setScrolled] = useState(false);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <>
      {/* Top bar */}
      <div className="bg-dark text-white text-xs text-center py-2 tracking-widest font-accent">
        MIỄN PHÍ VẬN CHUYỂN ĐƠN TRÊN 5.000.000Đ  ✦  GỖ TỰ NHIÊN CHÍNH HÃNG  ✦  BẢO HÀNH 5 NĂM
      </div>

      <header className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-md' : 'bg-cream'
      }`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-primary-500 rounded-sm flex items-center justify-center">
                <span className="text-white font-accent font-bold text-sm">D</span>
              </div>
              <div>
                <p className="font-accent text-lg font-bold text-dark leading-none tracking-wider">DAVINCI</p>
                <p className="text-[9px] tracking-[0.3em] text-primary-500 uppercase">Furniture</p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {NAV_LINKS.map(({ label, to }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `text-sm font-body tracking-wide transition-colors duration-200 hover:text-primary-500 relative group ${
                      isActive ? 'text-primary-500' : 'text-dark'
                    }`
                  }
                >
                  {label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary-500 transition-all duration-300 group-hover:w-full" />
                </NavLink>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              {/* Search + Visual Search */}
              <div className="hidden md:flex items-center gap-2">
                <SemanticSearchBar className="w-[280px] lg:w-[360px]" />
                <button
                  type="button"
                  onClick={() => setImageSearchOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-gray-500 transition-colors hover:border-primary-500 hover:text-primary-500"
                  title="Tìm kiếm bằng hình ảnh"
                >
                  <CameraIcon />
                </button>
              </div>

              {/* Wishlist */}
              <Link to="/wishlist" className="relative p-2 hover:text-primary-500 transition-colors">
                <HeartIcon />
              </Link>

              {/* Cart */}
              <button
                onClick={() => dispatch(toggleCart())}
                className="relative p-2 hover:text-primary-500 transition-colors"
              >
                <CartIcon />
                {cartCount > 0 && (
                  <motion.span
                    key={cartCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </motion.span>
                )}
              </button>

              {/* User */}
              {user ? (
                <div className="relative group hidden md:block">
                  <button className="flex items-center gap-1.5 text-sm hover:text-primary-500 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-xs">
                      {user.name?.[0]?.toUpperCase()}
                    </div>
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <Link to="/profile" className="block px-4 py-2 text-sm hover:bg-primary-50 hover:text-primary-600">Tài khoản</Link>
                    <Link to="/orders" className="block px-4 py-2 text-sm hover:bg-primary-50 hover:text-primary-600">Đơn hàng</Link>
                    <Link to="/wishlist" className="block px-4 py-2 text-sm hover:bg-primary-50 hover:text-primary-600">Yêu thích</Link>
                    {user.role === 'admin' && (
                      <Link to="/admin" className="block px-4 py-2 text-sm text-primary-600 font-medium hover:bg-primary-50">Admin Dashboard</Link>
                    )}
                    <hr className="my-1" />
                    <button onClick={() => dispatch(logout())} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50">Đăng xuất</button>
                  </div>
                </div>
              ) : (
                <Link to="/login" className="hidden md:inline-flex items-center gap-1 text-sm font-medium hover:text-primary-500 transition-colors">
                  <UserIcon /> Đăng nhập
                </Link>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => dispatch(mobileMenuOpen ? closeMobileMenu() : openMobileMenu())}
                className="lg:hidden p-2"
              >
                {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden overflow-hidden bg-white border-t border-gray-100"
            >
              <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
                {NAV_LINKS.map(({ label, to }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => dispatch(closeMobileMenu())}
                    className={({ isActive }) =>
                      `py-2 border-b border-gray-50 text-sm font-medium ${isActive ? 'text-primary-500' : 'text-dark'}`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    dispatch(closeMobileMenu());
                    setImageSearchOpen(true);
                  }}
                  className="py-2 border-b border-gray-50 text-left text-sm font-medium flex items-center gap-2 text-dark"
                >
                  📸 Tìm kiếm bằng hình ảnh
                </button>
                {user ? (
                  <button onClick={() => dispatch(logout())} className="text-left py-2 text-sm text-red-500">Đăng xuất</button>
                ) : (
                  <Link to="/login" onClick={() => dispatch(closeMobileMenu())} className="py-2 text-sm font-medium text-primary-500">Đăng nhập / Đăng ký</Link>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <ImageSearchModal isOpen={imageSearchOpen} onClose={() => setImageSearchOpen(false)} />
    </>
  );
};

// ── SVG Icons ─────────────────────────────────────────
const CameraIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);
const HeartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 0 1 6.364 0L12 7.636l1.318-1.318a4.5 4.5 0 1 1 6.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 0 1 0-6.364z" />
  </svg>
);
const CartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 0 0-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);
const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />
  </svg>
);
const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default Header;
