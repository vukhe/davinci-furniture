import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { Toaster } from 'react-hot-toast';
import { HelmetProvider } from 'react-helmet-async';
import { store, persistor } from './store';
import { ProtectedRoute, PageLoader } from './components/common';
import Layout from './components/layout/Layout';

// ── User Pages ────────────────────────────────────────
const HomePage          = lazy(() => import('./pages/HomePage'));
const ProductsPage      = lazy(() => import('./pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const CheckoutPage      = lazy(() => import('./pages/CheckoutPage'));
const CartPage          = lazy(() => import('./pages/CartPage'));
const ProfilePage       = lazy(() => import('./pages/ProfilePage'));
const OrdersPage        = lazy(() => import('./pages/OrdersPage'));
const OrderDetailPage   = lazy(() => import('./pages/OrderDetailPage'));
const WishlistPage      = lazy(() => import('./pages/WishlistPage'));
const BlogPage          = lazy(() => import('./pages/BlogPage'));
const BlogDetailPage    = lazy(() => import('./pages/BlogDetailPage'));
const DesignServicePage = lazy(() => import('./pages/DesignServicePage'));
const ContactPage       = lazy(() => import('./pages/ContactPage'));

// ── Auth Pages ────────────────────────────────────────
// AuthPages export nhiều named exports → dùng .then() đúng cách
// ── Collection Pages ─────────────────────────────────
const CollectionsListPage  = lazy(() => import('./pages/CollectionsPage').then(m => ({ default: m.CollectionsListPage })));
const CollectionDetailPage = lazy(() => import('./pages/CollectionsPage').then(m => ({ default: m.CollectionDetailPage })));

const LoginPage    = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/AuthPages').then(m => ({ default: m.RegisterPage })));

// ── Admin Pages ───────────────────────────────────────
// AdminDashboard export cả default (page) lẫn named (AdminLayout)
const AdminLayout    = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts  = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders    = lazy(() => import('./pages/admin/AdminOrders'));
const AdminUsers     = lazy(() => import('./pages/admin/AdminUsers'));
const AdminAnalytics    = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminCollections  = lazy(() => import('./pages/admin/AdminCollections'));
const AdminBlog      = lazy(() => import('./pages/admin/AdminBlog'));
const AdminVouchers  = lazy(() => import('./pages/admin/AdminVouchers'));
const AdminDesign    = lazy(() => import('./pages/admin/AdminDesign'));

const App = () => (
  <Provider store={store}>
    <PersistGate loading={<PageLoader />} persistor={persistor}>
      <HelmetProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: { fontFamily: '"DM Sans", sans-serif', fontSize: '14px' },
            }}
          />
          <Suspense fallback={<PageLoader />}>
            <Routes>

              {/* ── Public (Layout chứa Header + Footer) ── */}
              <Route element={<Layout />}>
                <Route index             element={<HomePage />} />
                <Route path="products"   element={<ProductsPage />} />
                <Route path="products/:slug" element={<ProductDetailPage />} />
                <Route path="blog"       element={<BlogPage />} />
                <Route path="blog/:slug" element={<BlogDetailPage />} />
                <Route path="design-service" element={<DesignServicePage />} />
                <Route path="contact"    element={<ContactPage />} />
                <Route path="cart"       element={<CartPage />} />
                <Route path="collections"   element={<CollectionsListPage />} />
                <Route path="collections/:slug" element={<CollectionDetailPage />} />

                {/* ── Protected: phải đăng nhập ───────── */}
                <Route path="checkout"   element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
                <Route path="profile"    element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="orders"     element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                <Route path="orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
                <Route path="wishlist"   element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
              </Route>

              {/* ── Auth (không có Layout) ─────────────── */}
              <Route path="login"    element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />

              {/* ── Admin: phải là admin ──────────────── */}
              <Route
                path="admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index              element={<AdminDashboard />} />
                <Route path="products"    element={<AdminProducts />} />
                <Route path="orders"      element={<AdminOrders />} />
                <Route path="users"       element={<AdminUsers />} />
                <Route path="analytics"    element={<AdminAnalytics />} />
                <Route path="collections"  element={<AdminCollections />} />
                <Route path="blog"        element={<AdminBlog />} />
                <Route path="vouchers"    element={<AdminVouchers />} />
                <Route path="design"      element={<AdminDesign />} />
              </Route>

              {/* ── 404 ──────────────────────────────── */}
              <Route path="*" element={
                <div className="min-h-screen flex items-center justify-center bg-cream">
                  <div className="text-center">
                    <p className="font-accent text-8xl text-primary-200 mb-4">404</p>
                    <h1 className="font-heading text-3xl text-dark mb-3">Trang không tồn tại</h1>
                    <a href="/" className="text-primary-500 hover:underline text-sm">← Về trang chủ</a>
                  </div>
                </div>
              } />

            </Routes>
          </Suspense>
        </BrowserRouter>
      </HelmetProvider>
    </PersistGate>
  </Provider>
);

export default App;
