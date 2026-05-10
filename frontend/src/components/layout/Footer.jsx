import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="bg-dark text-gray-300 pt-16 pb-6 mt-20">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

        {/* Brand */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary-500 rounded-sm flex items-center justify-center">
              <span className="text-white font-accent font-bold text-sm">D</span>
            </div>
            <div>
              <p className="font-accent text-lg font-bold text-white leading-none tracking-wider">DAVINCI</p>
              <p className="text-[9px] tracking-[0.3em] text-primary-400 uppercase">Furniture</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-gray-400">
            Đồ gỗ cao cấp – nơi nghệ thuật và sự bền bỉ gặp nhau. Mỗi sản phẩm đều được chế tác từ gỗ tự nhiên tuyển chọn.
          </p>
          <div className="flex gap-3 mt-5">
            {['facebook', 'instagram', 'youtube', 'tiktok'].map((s) => (
              <a key={s} href="#" className="w-9 h-9 rounded-full bg-dark-50 hover:bg-primary-500 flex items-center justify-center transition-colors duration-200 text-xs font-bold uppercase">
                {s[0]}
              </a>
            ))}
          </div>
        </div>

        {/* Products */}
        <div>
          <h4 className="font-accent text-white text-sm tracking-widest uppercase mb-5">Sản phẩm</h4>
          <ul className="space-y-2.5">
            {['Phòng khách', 'Phòng ngủ', 'Phòng ăn', 'Văn phòng', 'Bộ sưu tập mới'].map((item) => (
              <li key={item}>
                <Link to="/products" className="text-sm text-gray-400 hover:text-primary-400 transition-colors">{item}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Support */}
        <div>
          <h4 className="font-accent text-white text-sm tracking-widest uppercase mb-5">Hỗ trợ</h4>
          <ul className="space-y-2.5">
            {[
              { label: 'Chính sách đổi trả',  to: '/policy/return' },
              { label: 'Chính sách bảo hành', to: '/policy/warranty' },
              { label: 'Hướng dẫn chọn gỗ',   to: '/guide' },
              { label: 'Câu hỏi thường gặp',  to: '/faq' },
              { label: 'Liên hệ',              to: '/contact' },
            ].map(({ label, to }) => (
              <li key={label}>
                <Link to={to} className="text-sm text-gray-400 hover:text-primary-400 transition-colors">{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Contact & Newsletter */}
        <div>
          <h4 className="font-accent text-white text-sm tracking-widest uppercase mb-5">Liên hệ</h4>
          <ul className="space-y-3 text-sm text-gray-400 mb-6">
            <li>📍 123 Đường Lê Lợi, Q.1, TP.HCM</li>
            <li>📞 <a href="tel:0901234567" className="hover:text-primary-400">0901 234 567</a></li>
            <li>✉️ <a href="mailto:hello@davinci.vn" className="hover:text-primary-400">hello@davinci.vn</a></li>
          </ul>
          <p className="text-xs text-gray-500 mb-2 tracking-wider uppercase">Nhận ưu đãi mới nhất</p>
          <form className="flex" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Email của bạn"
              className="flex-1 text-sm px-3 py-2 bg-dark-50 border border-gray-700 rounded-l focus:outline-none focus:border-primary-500 text-white placeholder:text-gray-600"
            />
            <button className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded-r transition-colors">
              Gửi
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-600">
        <p>© {new Date().getFullYear()} DaVinci Furniture. All rights reserved.</p>
        <div className="flex gap-4">
          <Link to="/policy/privacy" className="hover:text-gray-400">Chính sách bảo mật</Link>
          <Link to="/policy/terms" className="hover:text-gray-400">Điều khoản sử dụng</Link>
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
