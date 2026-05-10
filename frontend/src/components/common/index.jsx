import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

// ── Button ────────────────────────────────────────────
export const Button = ({
  children, variant = 'primary', size = 'md',
  loading = false, className = '', ...props
}) => {
  const base = 'inline-flex items-center justify-center font-medium tracking-wider transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-sm';
  const variants = {
    primary:  'bg-dark text-white hover:bg-primary-500',
    outline:  'border border-dark text-dark hover:bg-dark hover:text-white',
    gold:     'bg-primary-500 text-white hover:bg-primary-600',
    ghost:    'text-dark hover:bg-gray-100',
    danger:   'bg-red-500 text-white hover:bg-red-600',
  };
  const sizes = {
    sm:  'px-4 py-2 text-xs',
    md:  'px-6 py-3 text-sm',
    lg:  'px-8 py-4 text-base',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Spinner size="sm" className="mr-2" />}
      {children}
    </button>
  );
};

// ── Spinner ───────────────────────────────────────────
export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <svg className={`animate-spin ${sizes[size]} ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
};

// ── PageLoader ────────────────────────────────────────
export const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-cream">
    <div className="text-center space-y-3">
      <div className="w-12 h-12 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin mx-auto" />
      <p className="text-sm text-gray-400 font-body">Đang tải...</p>
    </div>
  </div>
);

// ── Empty State ───────────────────────────────────────
export const EmptyState = ({ icon, title, description, action }) => (
  <div className="text-center py-20 space-y-4">
    {icon && <div className="text-5xl">{icon}</div>}
    <h3 className="font-heading text-xl text-dark">{title}</h3>
    {description && <p className="text-sm text-gray-400 max-w-xs mx-auto">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

// ── Badge ─────────────────────────────────────────────
export const Badge = ({ children, color = 'gray' }) => {
  const colors = {
    gray:    'bg-gray-100 text-gray-600',
    green:   'bg-green-100 text-green-700',
    yellow:  'bg-yellow-100 text-yellow-700',
    red:     'bg-red-100 text-red-600',
    blue:    'bg-blue-100 text-blue-700',
    primary: 'bg-primary-100 text-primary-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  );
};

// ── Order Status Badge ────────────────────────────────
const STATUS_MAP = {
  pending:   { label: 'Chờ xác nhận', color: 'yellow' },
  confirmed: { label: 'Đã xác nhận',  color: 'blue' },
  shipping:  { label: 'Đang giao',    color: 'blue' },
  completed: { label: 'Hoàn thành',   color: 'green' },
  cancelled: { label: 'Đã hủy',       color: 'red' },
  paid:      { label: 'Đã thanh toán',color: 'green' },
  failed:    { label: 'Thất bại',     color: 'red' },
};

export const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || { label: status, color: 'gray' };
  return <Badge color={s.color}>{s.label}</Badge>;
};

// ── Protected Route ───────────────────────────────────
export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { token, user, userLoading } = useSelector((s) => s.auth);
  const location = useLocation();

  // Chưa có token → redirect login
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;

  // Đang fetch user data → hiện spinner
  if (userLoading || (token && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Đã load xong nhưng không có user (token hết hạn) → redirect login
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  // Không đủ quyền admin
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;

  return children;
};

// ── Section Title ─────────────────────────────────────
export const SectionTitle = ({ label, title, subtitle, center = false }) => (
  <div className={`mb-10 ${center ? 'text-center' : ''}`}>
    {label && (
      <p className="text-xs font-accent tracking-[0.4em] text-primary-500 uppercase mb-2">{label}</p>
    )}
    <h2 className="font-heading text-3xl md:text-4xl text-dark leading-tight">{title}</h2>
    {subtitle && <p className="text-gray-400 mt-3 max-w-lg">{subtitle}</p>}
  </div>
);

// ── Breadcrumb ────────────────────────────────────────
export const Breadcrumb = ({ items = [] }) => (
  <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6">
    {items.map((item, i) => (
      <span key={i} className="flex items-center gap-2">
        {i > 0 && <span>/</span>}
        {item.to ? (
          <a href={item.to} className="hover:text-primary-500 transition-colors">{item.label}</a>
        ) : (
          <span className="text-dark font-medium">{item.label}</span>
        )}
      </span>
    ))}
  </nav>
);

// ── Input ─────────────────────────────────────────────
export const Input = ({ label, error, className = '', ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <input
      className={`w-full px-4 py-2.5 border rounded-sm text-sm outline-none transition-all
        ${error ? 'border-red-400 focus:ring-1 focus:ring-red-400' : 'border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-200'}
        ${className}`}
      {...props}
    />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);

// ── Textarea ──────────────────────────────────────────
export const Textarea = ({ label, error, className = '', ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
    <textarea
      className={`w-full px-4 py-2.5 border rounded-sm text-sm outline-none transition-all resize-none
        ${error ? 'border-red-400' : 'border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-200'}
        ${className}`}
      {...props}
    />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);
