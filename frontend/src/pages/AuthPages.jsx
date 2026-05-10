import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuth from '../hooks/useAuth';
import { Button, Input } from '../components/common';

export const LoginPage = () => {
  const { login, loading, error } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';
  const [form, setForm] = useState({ email: '', password: '' });

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Left image panel */}
      <div className="hidden lg:flex flex-1 bg-cover bg-center" style={{ backgroundImage: "url('/banners/login-bg.jpg')" }}>
        <div className="flex-1 bg-dark/50 flex items-center justify-center">
          <div className="text-white text-center">
            <p className="font-accent text-xs tracking-[0.4em] text-primary-300 mb-4">DAVINCI FURNITURE</p>
            <h1 className="font-heading text-5xl leading-tight">Nơi phong cách<br />gặp gỡ tinh tế</h1>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <Link to="/" className="flex items-center gap-2 mb-10">
            <div className="w-8 h-8 bg-primary-500 rounded-sm flex items-center justify-center">
              <span className="text-white font-accent font-bold text-sm">D</span>
            </div>
            <span className="font-accent text-lg font-bold text-dark tracking-wider">DAVINCI</span>
          </Link>

          <h2 className="font-heading text-3xl text-dark mb-2">Đăng nhập</h2>
          <p className="text-gray-400 text-sm mb-8">Chào mừng bạn trở lại!</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-sm mb-5">
              {error}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); login(form, from); }} className="space-y-5">
            <Input label="Email" name="email" type="email" value={form.email} onChange={handle} required placeholder="you@example.com" />
            <Input label="Mật khẩu" name="password" type="password" value={form.password} onChange={handle} required placeholder="••••••••" />

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary-500 hover:underline">Quên mật khẩu?</Link>
            </div>

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              ĐĂNG NHẬP
            </Button>
          </form>

          <p className="text-sm text-gray-400 text-center mt-6">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-primary-500 font-medium hover:underline">Đăng ký ngay</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export const RegisterPage = () => {
  const { register, loading, error } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-sm shadow-sm border border-gray-100 p-10"
      >
        <Link to="/" className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-primary-500 rounded-sm flex items-center justify-center">
            <span className="text-white font-accent font-bold text-sm">D</span>
          </div>
          <span className="font-accent text-lg font-bold text-dark tracking-wider">DAVINCI</span>
        </Link>

        <h2 className="font-heading text-3xl text-dark mb-2">Đăng ký</h2>
        <p className="text-gray-400 text-sm mb-8">Tạo tài khoản để mua sắm dễ dàng hơn</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-sm mb-5">{error}</div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); register(form); }} className="space-y-4">
          <Input label="Họ tên *" name="name" value={form.name} onChange={handle} required placeholder="Nguyễn Văn A" />
          <Input label="Email *" name="email" type="email" value={form.email} onChange={handle} required placeholder="you@example.com" />
          <Input label="Số điện thoại" name="phone" value={form.phone} onChange={handle} placeholder="0901 234 567" />
          <Input label="Mật khẩu *" name="password" type="password" value={form.password} onChange={handle} required placeholder="Tối thiểu 6 ký tự" />

          <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-2">
            ĐĂNG KÝ
          </Button>
        </form>

        <p className="text-sm text-gray-400 text-center mt-6">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-primary-500 font-medium hover:underline">Đăng nhập</Link>
        </p>
      </motion.div>
    </div>
  );
};
