import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';
import { fetchFeatured, fetchBestSelling, fetchCategories } from '../store/slices/productSlice';
import ProductCard from '../components/product/ProductCard';
import RecommendationSection from '../components/ai/RecommendationSection';
import { SectionTitle } from '../components/common';

const BANNERS = [
  {
    id: 1,
    title: 'Nghệ Thuật Trong\nTừng Góc Nhà',
    subtitle: 'Bộ sưu tập đồ gỗ cao cấp 2024 – gỗ tự nhiên tuyển chọn, bền đẹp theo năm tháng',
    cta: 'Khám phá ngay',
    to: '/products',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1600&q=80&fit=crop',
  },
  {
    id: 2,
    title: 'Phòng Ngủ\nLý Tưởng',
    subtitle: 'Giường gỗ sồi, gỗ óc chó nguyên tấm – chắc chắn và sang trọng',
    cta: 'Xem bộ sưu tập',
    to: '/products?category=2',
    image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=1600&q=80&fit=crop',
  },
  {
    id: 3,
    title: 'Văn Phòng\nChuyên Nghiệp',
    subtitle: 'Bàn làm việc, kệ sách gỗ tự nhiên – gọn gàng và bền đẹp cho không gian văn phòng',
    cta: 'Tìm hiểu thêm',
    to: '/products?category=4',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80&fit=crop',
  },
];

const COLLECTIONS = [
  { name: 'Phòng khách', desc: '120+ sản phẩm', to: '/products?category=1', image: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=800&q=80&fit=crop' },
  { name: 'Phòng ngủ',   desc: '85+ sản phẩm',  to: '/products?category=2', image: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80&fit=crop' },
  { name: 'Phòng ăn',    desc: '60+ sản phẩm',  to: '/products?category=3', image: 'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?w=800&q=80&fit=crop' },
  { name: 'Văn phòng',   desc: '45+ sản phẩm',  to: '/products?category=4', image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80&fit=crop' },
];

const FEATURES = [
  { icon: '🌳', title: 'Gỗ tự nhiên cao cấp',  desc: 'Nguyên liệu chứng nhận FSC từ rừng bền vững' },
  { icon: '🔨', title: 'Thủ công tinh xảo',     desc: '100% do thợ mộc lành nghề chế tác tỉ mỉ' },
  { icon: '🚚', title: 'Miễn phí vận chuyển',   desc: 'Giao hàng tận nơi, lắp đặt miễn phí cho đơn trên 5 triệu' },
  { icon: '🛡️', title: 'Bảo hành 5 năm',       desc: 'Cam kết bảo hành chính hãng lên đến 5 năm' },
];

const TESTIMONIALS = [
  {
    name: 'Nguyễn Minh Anh', role: 'Kiến trúc sư',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80&fit=crop&crop=face',
    text: 'Bộ bàn ăn gỗ sồi nhà mình đặt 2 năm vẫn đẹp như mới. Gỗ thật 100%, thợ mộc tay nghề cao.', rating: 5,
  },
  {
    name: 'Trần Thanh Hùng', role: 'Doanh nhân',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80&fit=crop&crop=face',
    text: 'Mua chiếc bàn làm việc gỗ óc chó, giao đúng hẹn và đóng gói rất cẩn thận. Hài lòng lắm!', rating: 5,
  },
  {
    name: 'Lê Thu Hằng', role: 'Nội trợ',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80&fit=crop&crop=face',
    text: 'Kệ sách gỗ thông nhà mình đặt riêng theo kích thước. Đội tư vấn nhiệt tình, xưởng làm đúng mẫu.', rating: 5,
  },
];

const BLOG_PREVIEW = [
  { title: 'Tại sao gỗ óc chó luôn là lựa chọn số 1 cho đồ gỗ cao cấp?', excerpt: 'Tìm hiểu đặc tính, nguồn gốc và lý do gỗ óc chó được ưa chuộng nhất hiện nay', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80&fit=crop', slug: 'xu-huong-noi-that-2024' },
  { title: 'Gỗ sồi và gỗ tần bì – khác nhau điều gì?', excerpt: 'So sánh chi tiết 2 loại gỗ phổ biến nhất trong sản xuất đồ gỗ gia dụng', image: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600&q=80&fit=crop', slug: 'cach-chon-sofa' },
  { title: 'Cách bảo quản đồ gỗ bền đẹp theo năm tháng', excerpt: 'Hướng dẫn vệ sinh, đánh bóng và bảo quản đồ gỗ tự nhiên tại nhà đúng cách', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&fit=crop', slug: 'go-oc-cho' },
];

const DEMO_PRODUCTS = [
  { id: 1, name: 'Bàn Ăn Gỗ Sồi Nguyên Khối 6 Ghế', slug: 'sofa-da-milano', price: 28500000, sale_price: 22000000, category_name: 'Phòng khách', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80&fit=crop', avg_rating: 4.8, review_count: 24, stock: 5, is_featured: true },
  { id: 2, name: 'Bàn Ăn Gỗ Óc Chó Nguyên Tấm', slug: 'ban-an-go-oc-cho', price: 18900000, sale_price: null, category_name: 'Phòng ăn', image: 'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?w=600&q=80&fit=crop', avg_rating: 5, review_count: 12, stock: 3, is_featured: false },
  { id: 3, name: 'Giường Gỗ Gõ Đỏ King Size 1m8', slug: 'giuong-ngu-platform', price: 32000000, sale_price: 25600000, category_name: 'Phòng ngủ', image: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&q=80&fit=crop', avg_rating: 4.6, review_count: 8, stock: 2, is_featured: true },
  { id: 4, name: 'Kệ Sách Gỗ Sồi 5 Tầng', slug: 'ke-sach-go-thong', price: 8500000, sale_price: 6800000, category_name: 'Phòng khách', image: 'https://images.unsplash.com/photo-1593085512500-5d55148d6f0d?w=600&q=80&fit=crop', avg_rating: 4.4, review_count: 31, stock: 10, is_featured: false },
  { id: 5, name: 'Bàn Làm Việc Gỗ Óc Chó Nguyên Tấm', slug: 'ghe-van-phong-ergonomic', price: 12000000, sale_price: 9500000, category_name: 'Văn phòng', image: 'https://images.unsplash.com/photo-1541558869434-2840d308329a?w=600&q=80&fit=crop', avg_rating: 4.9, review_count: 47, stock: 8, is_featured: true },
  { id: 6, name: 'Tủ Quần Áo Gỗ Sồi 4 Cánh', slug: 'tu-quan-ao-walk-in', price: 45000000, sale_price: null, category_name: 'Phòng ngủ', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80&fit=crop', avg_rating: 4.7, review_count: 6, stock: 1, is_featured: false },
  { id: 7, name: 'Bàn Cà Phê Gỗ Tràm Bông Vàng', slug: 'ban-ca-phe-kinh', price: 6500000, sale_price: 5200000, category_name: 'Phòng khách', image: 'https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=600&q=80&fit=crop', avg_rating: 4.3, review_count: 19, stock: 7, is_featured: false },
  { id: 8, name: 'Ghế Ngồi Gỗ Cao Su Có Nệm', slug: 'den-san-scandinavian', price: 4200000, sale_price: 3300000, category_name: 'Phòng khách', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80&fit=crop', avg_rating: 4.5, review_count: 22, stock: 15, is_featured: false },
];

const StarRating = ({ rating }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map((s) => (
      <svg key={s} className={`w-3.5 h-3.5 ${s <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z" />
      </svg>
    ))}
  </div>
);

const HomePage = () => {
  const dispatch = useDispatch();
  const { featured, bestSelling } = useSelector((s) => s.product);
  const displayFeatured    = featured.length    > 0 ? featured    : DEMO_PRODUCTS.slice(0, 4);
  const displayBestSelling = bestSelling.length > 0 ? bestSelling : DEMO_PRODUCTS.slice(4, 8);

  useEffect(() => {
    dispatch(fetchFeatured());
    dispatch(fetchBestSelling());
    dispatch(fetchCategories());
  }, []);

  return (
    <div className="overflow-x-hidden">

      {/* HERO */}
      <section>
        <Swiper
          modules={[Autoplay, Pagination, EffectFade]}
          effect="fade"
          autoplay={{ delay: 5500, disableOnInteraction: false }}
          pagination={{ clickable: true }}
          loop
          className="h-[85vh] min-h-[560px]"
        >
          {BANNERS.map((banner) => (
            <SwiperSlide key={banner.id}>
              <div className="relative h-full w-full bg-cover bg-center flex items-center" style={{ backgroundImage: `url(${banner.image})` }}>
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
                <div className="relative container mx-auto px-6">
                  <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9 }} className="max-w-2xl">
                    <p className="font-accent text-xs tracking-[0.5em] text-primary-300 uppercase mb-5">DaVinci Furniture</p>
                    <h1 className="font-heading text-5xl md:text-7xl text-white leading-tight mb-6 whitespace-pre-line">{banner.title}</h1>
                    <p className="text-white/75 text-lg mb-10 leading-relaxed max-w-lg">{banner.subtitle}</p>
                    <div className="flex items-center gap-5 flex-wrap">
                      <Link to={banner.to} className="inline-flex items-center gap-3 bg-primary-500 text-white px-8 py-4 text-sm font-medium tracking-widest hover:bg-primary-400 transition-all rounded-sm shadow-lg">
                        {banner.cta} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                      </Link>
                      <Link to="/contact" className="text-white/75 text-sm hover:text-white border-b border-white/40 hover:border-white pb-0.5 transition-colors">
                        Tư vấn miễn phí →
                      </Link>
                    </div>
                  </motion.div>
                </div>
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40">
                  <span className="text-[10px] tracking-widest uppercase">Cuộn xuống</span>
                  <div className="w-px h-8 bg-gradient-to-b from-white/50 to-transparent" />
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </section>

      {/* FEATURES */}
      <section className="bg-dark">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-800">
            {FEATURES.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 px-5 py-6 text-white">
                <span className="text-2xl">{f.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 hidden md:block">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* COLLECTIONS */}
      <section className="container mx-auto px-4 py-20">
        <div className="flex items-end justify-between mb-10">
          <SectionTitle label="Danh mục" title="Không gian sống của bạn" />
          <Link to="/products" className="text-sm text-primary-500 hover:underline hidden md:block">Xem tất cả →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="col-span-2 row-span-2">
            <Link to={COLLECTIONS[0].to} className="group relative block overflow-hidden rounded-sm h-full min-h-[400px]">
              <img src={COLLECTIONS[0].image} alt={COLLECTIONS[0].name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-7">
                <p className="text-xs text-primary-300 tracking-widest uppercase mb-1">{COLLECTIONS[0].desc}</p>
                <h3 className="font-heading text-white text-4xl">{COLLECTIONS[0].name}</h3>
                <span className="inline-flex items-center gap-1 text-white/70 text-sm mt-3 group-hover:text-white group-hover:gap-2 transition-all">Khám phá →</span>
              </div>
            </Link>
          </div>
          {COLLECTIONS.slice(1).map((col, i) => (
            <motion.div key={col.name} initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <Link to={col.to} className="group relative block overflow-hidden rounded-sm aspect-[4/3]">
                <img src={col.image} alt={col.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-[10px] text-primary-300 tracking-widest uppercase">{col.desc}</p>
                  <h3 className="font-heading text-white text-xl">{col.name}</h3>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section className="bg-stone-50 py-20">
        <div className="container mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <SectionTitle label="Nổi bật" title="Sản phẩm được yêu thích" />
            <Link to="/products?featured=true" className="text-sm text-primary-500 hover:underline hidden md:block">Xem tất cả →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {displayFeatured.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </div>
      </section>

      {/* DESIGN CTA */}
      <section className="relative py-36 overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-fixed" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1600&q=80&fit=crop')" }} />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative container mx-auto px-4 text-center text-white">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-2xl mx-auto">
            <p className="font-accent text-xs tracking-[0.5em] text-primary-400 uppercase mb-4">Đặt hàng theo yêu cầu</p>
            <h2 className="font-heading text-4xl md:text-6xl leading-tight mb-5">Tư vấn thiết kế<br />nội thất miễn phí</h2>
            <p className="text-white/70 text-lg mb-10 leading-relaxed">Chúng tôi nhận đặt làm theo kích thước, màu sơn và loại gỗ theo yêu cầu riêng của bạn. Báo giá miễn phí trong 24 giờ.</p>
            <Link to="/contact" className="inline-flex items-center gap-3 bg-primary-500 text-white px-10 py-5 text-sm font-medium tracking-widest hover:bg-primary-400 transition-colors rounded-sm">
              ĐẶT HÀNG THEO YÊU CẦU <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* BEST SELLING */}
      <section className="container mx-auto px-4 py-20">
        <div className="flex items-end justify-between mb-10">
          <SectionTitle label="Bán chạy" title="Đang được ưa chuộng nhất" />
          <Link to="/products?sort=sold" className="text-sm text-primary-500 hover:underline hidden md:block">Xem tất cả →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {displayBestSelling.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </section>

      <RecommendationSection />

      {/* TESTIMONIALS */}
      <section className="bg-dark py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="font-accent text-xs tracking-[0.4em] text-primary-400 uppercase mb-3">Khách hàng nói gì</p>
            <h2 className="font-heading text-3xl text-white">Đánh giá từ khách hàng</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}
                className="bg-white/5 border border-white/10 rounded-sm p-7">
                <StarRating rating={t.rating} />
                <p className="text-gray-300 text-sm leading-relaxed mt-4 mb-6 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full object-cover" />
                  <div>
                    <p className="text-white text-sm font-medium">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* BLOG */}
      <section className="container mx-auto px-4 py-20">
        <div className="flex items-end justify-between mb-10">
          <SectionTitle label="Blog" title="Cảm hứng thiết kế" />
          <Link to="/blog" className="text-sm text-primary-500 hover:underline hidden md:block">Xem tất cả →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BLOG_PREVIEW.map((post, i) => (
            <motion.article key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="group">
              <Link to={`/blog/${post.slug}`}>
                <div className="aspect-video rounded-sm overflow-hidden bg-gray-100 mb-4">
                  <img src={post.image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <h3 className="font-heading text-lg text-dark group-hover:text-primary-600 transition-colors mb-2 leading-snug">{post.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">{post.excerpt}</p>
                <span className="inline-block text-xs text-primary-500 mt-3 font-medium group-hover:underline">Đọc tiếp →</span>
              </Link>
            </motion.article>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="bg-primary-500 py-14">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
            {[{ num: '10+', label: 'Năm kinh nghiệm' }, { num: '5,000+', label: 'Khách hàng hài lòng' }, { num: '1,200+', label: 'Sản phẩm đa dạng' }, { num: '98%', label: 'Đánh giá 5 sao' }].map(({ num, label }, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <p className="font-heading text-4xl md:text-5xl font-bold mb-1">{num}</p>
                <p className="text-primary-100 text-sm">{label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default HomePage;
