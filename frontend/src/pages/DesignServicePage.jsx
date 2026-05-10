import { useState } from 'react';
import { motion } from 'framer-motion';
import { designAPI } from '../services/api';
import { Button, Input, Textarea } from '../components/common';
import toast from 'react-hot-toast';

const SERVICES = [
  { icon: '🏠', title: 'Thiết kế nội thất toàn bộ', desc: 'Thiết kế và thi công trọn gói từ A đến Z cho toàn bộ căn nhà' },
  { icon: '🛋️', title: 'Thiết kế phòng khách',      desc: 'Tạo không gian tiếp khách sang trọng, phong cách và tiện nghi' },
  { icon: '🛏️', title: 'Thiết kế phòng ngủ',        desc: 'Không gian nghỉ ngơi lý tưởng kết hợp thẩm mỹ và công năng' },
  { icon: '🏢', title: 'Thiết kế văn phòng',         desc: 'Môi trường làm việc chuyên nghiệp nâng cao năng suất' },
];

const PROCESS = [
  { step: '01', title: 'Tư vấn',     desc: 'Gặp gỡ & lắng nghe nhu cầu, phong cách và ngân sách của bạn' },
  { step: '02', title: 'Thiết kế',   desc: 'Đội ngũ kiến trúc sư lên bản vẽ 2D/3D chi tiết' },
  { step: '03', title: 'Duyệt',      desc: 'Chỉnh sửa theo yêu cầu cho đến khi bạn hài lòng 100%' },
  { step: '04', title: 'Thi công',   desc: 'Thực hiện thi công với đội ngũ lành nghề, đúng tiến độ' },
];

const DesignServicePage = () => {
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await designAPI.submit(form);
      setSubmitted(true);
      toast.success('Yêu cầu đã được gửi thành công!');
    } catch (err) {
      toast.error(err.message || 'Gửi thất bại, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Hero */}
      <div className="relative bg-stone-900 py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/banners/design-bg.jpg')] bg-cover bg-center opacity-30" />
        <div className="relative container mx-auto px-4 text-center text-white">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="font-accent text-xs tracking-[0.4em] text-primary-400 uppercase mb-4">Dịch vụ cao cấp</p>
            <h1 className="font-heading text-4xl md:text-6xl mb-5 leading-tight">
              Thiết kế nội thất<br />theo yêu cầu
            </h1>
            <p className="text-white/70 text-lg max-w-xl mx-auto">
              Đội ngũ kiến trúc sư & nhà thiết kế giàu kinh nghiệm, biến không gian sống của bạn thành tác phẩm nghệ thuật.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Services */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <p className="font-accent text-xs tracking-[0.4em] text-primary-500 uppercase mb-2">Chúng tôi cung cấp</p>
          <h2 className="font-heading text-3xl text-dark">Dịch vụ thiết kế</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-6 border border-gray-100 rounded-sm hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="text-4xl mb-4">{s.icon}</div>
              <h3 className="font-heading text-base mb-2">{s.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Process */}
      <section className="bg-dark py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="font-accent text-xs tracking-[0.4em] text-primary-400 uppercase mb-2">Quy trình</p>
            <h2 className="font-heading text-3xl text-white">Làm việc với chúng tôi</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {PROCESS.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center text-white"
              >
                <div className="w-14 h-14 rounded-full border-2 border-primary-500 flex items-center justify-center mx-auto mb-4">
                  <span className="font-accent text-primary-400 font-bold">{p.step}</span>
                </div>
                <h3 className="font-heading text-lg mb-2">{p.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="container mx-auto px-4 py-20 max-w-2xl">
        <div className="text-center mb-10">
          <p className="font-accent text-xs tracking-[0.4em] text-primary-500 uppercase mb-2">Liên hệ ngay</p>
          <h2 className="font-heading text-3xl text-dark">Đăng ký tư vấn miễn phí</h2>
          <p className="text-gray-400 mt-2 text-sm">Chúng tôi sẽ liên hệ với bạn trong vòng 24 giờ</p>
        </div>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 bg-green-50 border border-green-100 rounded-sm"
          >
            <p className="text-5xl mb-4">🎉</p>
            <h3 className="font-heading text-xl text-green-700 mb-2">Yêu cầu đã được gửi!</h3>
            <p className="text-sm text-green-600">Đội ngũ của chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-sm shadow-sm p-8 space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2 md:col-span-1">
                <Input label="Họ tên *" name="full_name" value={form.full_name} onChange={handle} required placeholder="Nguyễn Văn A" />
              </div>
              <div className="col-span-2 md:col-span-1">
                <Input label="Số điện thoại *" name="phone" value={form.phone} onChange={handle} required placeholder="0901 234 567" />
              </div>
              <div className="col-span-2">
                <Input label="Email" name="email" type="email" value={form.email} onChange={handle} placeholder="email@example.com" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Mô tả yêu cầu</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handle}
                  rows={5}
                  placeholder="Diện tích, phong cách mong muốn, ngân sách dự kiến..."
                  className="w-full border border-gray-200 rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-primary-500 resize-none"
                />
              </div>
            </div>
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              GỬI YÊU CẦU TƯ VẤN
            </Button>
          </form>
        )}
      </section>
    </div>
  );
};

export default DesignServicePage;
