import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Input, Breadcrumb } from '../components/common';
import toast from 'react-hot-toast';

const CONTACT_INFO = [
  { icon: '📍', label: 'Địa chỉ',   value: '123 Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh' },
  { icon: '📞', label: 'Điện thoại', value: '0901 234 567', href: 'tel:0901234567' },
  { icon: '✉️', label: 'Email',      value: 'hello@davinci.vn', href: 'mailto:hello@davinci.vn' },
  { icon: '🕐', label: 'Giờ mở cửa', value: 'Thứ 2 – Thứ 7: 8:00 – 20:00\nChủ nhật: 9:00 – 18:00' },
];

const ContactPage = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate send (in production, call a contact API)
    await new Promise((r) => setTimeout(r, 1000));
    toast.success('Tin nhắn đã được gửi! Chúng tôi sẽ phản hồi sớm nhất.');
    setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Liên hệ' }]} />

      <div className="text-center mb-14">
        <p className="font-accent text-xs tracking-[0.4em] text-primary-500 uppercase mb-2">Hãy nói chuyện</p>
        <h1 className="font-heading text-4xl text-dark">Liên hệ với chúng tôi</h1>
        <p className="text-gray-400 mt-3 max-w-md mx-auto">Chúng tôi luôn sẵn sàng lắng nghe và hỗ trợ bạn</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 max-w-5xl mx-auto">
        {/* Info */}
        <div className="lg:col-span-2 space-y-6">
          {CONTACT_INFO.map(({ icon, label, value, href }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex gap-4"
            >
              <div className="w-10 h-10 rounded-sm bg-primary-50 flex items-center justify-center text-lg flex-shrink-0">
                {icon}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
                {href ? (
                  <a href={href} className="text-sm text-dark hover:text-primary-500 transition-colors font-medium">
                    {value}
                  </a>
                ) : (
                  <p className="text-sm text-dark font-medium whitespace-pre-line">{value}</p>
                )}
              </div>
            </motion.div>
          ))}

          {/* Social */}
          <div className="pt-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Mạng xã hội</p>
            <div className="flex gap-3">
              {['Facebook', 'Instagram', 'YouTube', 'TikTok'].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="w-9 h-9 border border-gray-200 rounded-sm flex items-center justify-center text-xs font-bold text-gray-400 hover:border-primary-500 hover:text-primary-500 transition-colors"
                >
                  {s[0]}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-3">
          <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-sm shadow-sm p-8 space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Input label="Họ tên *" name="name" value={form.name} onChange={handle} required placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <Input label="Số điện thoại" name="phone" value={form.phone} onChange={handle} placeholder="0901 234 567" />
              </div>
              <div className="col-span-2">
                <Input label="Email *" name="email" type="email" value={form.email} onChange={handle} required placeholder="email@example.com" />
              </div>
              <div className="col-span-2">
                <Input label="Tiêu đề" name="subject" value={form.subject} onChange={handle} placeholder="Chủ đề liên hệ" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nội dung *</label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handle}
                  required
                  rows={5}
                  placeholder="Nội dung tin nhắn của bạn..."
                  className="w-full border border-gray-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-primary-500 resize-none"
                />
              </div>
            </div>
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              GỬI TIN NHẮN
            </Button>
          </form>
        </div>
      </div>

      {/* Map placeholder */}
      <div className="mt-16 rounded-sm overflow-hidden bg-gray-100 h-64 flex items-center justify-center max-w-5xl mx-auto border border-gray-200">
        <div className="text-center text-gray-400">
          <p className="text-3xl mb-2">🗺️</p>
          <p className="text-sm">Google Maps – 123 Đường Lê Lợi, Q.1, TP.HCM</p>
          <a
            href="https://maps.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary-500 hover:underline mt-1 inline-block"
          >
            Xem trên Google Maps →
          </a>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
