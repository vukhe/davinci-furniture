import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { fetchProductBySlug } from '../store/slices/productSlice';
import { addToCart } from '../store/slices/cartSlice';
import { toggleWishlist, selectIsWishlisted } from '../store/slices/wishlistSlice';
import { openCart } from '../store/slices/uiSlice';
import { reviewAPI } from '../services/api';
import { formatPrice } from '../utils/format';
import ProductCard from '../components/product/ProductCard';
import SimilarProducts from '../components/ai/SimilarProducts';
import CoPurchaseSection from '../components/ai/CoPurchaseSection';
import { Badge, Breadcrumb, Button, Spinner } from '../components/common';
import toast from 'react-hot-toast';

const DETAIL_LABELS = [
  'Chất liệu vải bọc',
  'Tùy chọn chất liệu khác',
  'Tuỳ chọn chất liệu khác',
  'Chất liệu khung ghế',
  'Loại đệm mút',
  'Chất liệu chân ghế',
  'Chất liệu mặt bàn',
  'Chất liệu chân bàn',
  'Màu sắc mặt bàn',
  'Màu sắc chân bàn',
  'Màu sắc chân ghế',
  'Màu sắc khung ghế',
];

const PURCHASE_POINTS = [
  { title: 'Tư vấn cấu hình', description: 'Hỗ trợ chọn chất liệu, màu sắc và phiên bản phù hợp với không gian.' },
  { title: 'Giao hàng nội thành', description: 'Ưu tiên lắp đặt nhanh cho đơn nội thất trong khu vực thành phố.' },
  { title: 'Bảo hành rõ ràng', description: 'Theo dõi tình trạng sản phẩm và hỗ trợ sau bán hàng thuận tiện.' },
];

const SERVICE_POLICIES = [
  'Giá hiển thị theo cấu hình hiện tại của sản phẩm.',
  'Có thể thay đổi chất liệu, màu sắc hoặc kích thước theo từng mẫu.',
  'Liên hệ trước để xác nhận tồn kho hoặc lịch giao hàng.',
];

const trackView = (productId) => {
  if (!productId) return;
  try {
    const key = 'dv_view_history';
    const history = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = [productId, ...history.filter((id) => id !== productId)].slice(0, 50);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (error) {
    // Ignore storage failures.
  }
};

const cleanText = (value = '') =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildParagraphs = (value = '') => {
  const cleaned = cleanText(value);
  if (!cleaned) return [];

  const sentences = cleaned.split(/(?<=[.!?])\s+/u).filter(Boolean);
  if (sentences.length <= 2) return [cleaned];

  const paragraphs = [];
  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join(' '));
  }

  return paragraphs;
};

const extractDetailItems = (detailText = '') => {
  const cleaned = cleanText(detailText);
  if (!cleaned) return [];

  const hits = DETAIL_LABELS
    .map((label) => {
      const index = cleaned.indexOf(label);
      return index === -1 ? null : { label, index };
    })
    .filter(Boolean)
    .sort((left, right) => left.index - right.index)
    .filter((hit, index, array) => index === 0 || hit.index !== array[index - 1].index);

  const items = [];
  for (let index = 0; index < hits.length; index += 1) {
    const current = hits[index];
    const next = hits[index + 1];
    const start = current.index + current.label.length;
    const end = next ? next.index : cleaned.length;
    const value = cleanText(cleaned.slice(start, end));

    if (!value || value === current.label) continue;
    if (/^t[uù]y ch[oọ]n ch[aấ]t li[eệ]u kh[aá]c$/i.test(value)) continue;

    items.push({
      label: current.label.replace('Tuỳ', 'Tùy'),
      value,
    });
  }

  return items;
};

const buildDescriptionData = (description = '') => {
  const cleaned = cleanText(description);
  const marker = 'Mô tả sản phẩm';
  const markerIndex = cleaned.indexOf(marker);

  const overview = cleanText(
    (markerIndex >= 0 ? cleaned.slice(0, markerIndex) : cleaned).replace(/^Mô tả\s*/u, '')
  );
  const detailSource = markerIndex >= 0 ? cleanText(cleaned.slice(markerIndex + marker.length)) : '';
  const detailItems = extractDetailItems(detailSource);

  let note = detailSource;
  detailItems.forEach((item) => {
    note = cleanText(note.replace(`${item.label} ${item.value}`, ' '));
  });

  return {
    overviewParagraphs: buildParagraphs(overview),
    detailItems,
    supplementaryNote: note.length > 32 ? note : '',
  };
};

const renderRatingStars = (rating, sizeClass = 'w-4 h-4') =>
  [1, 2, 3, 4, 5].map((star) => (
    <svg
      key={star}
      className={`${sizeClass} ${star <= Math.round(rating) ? 'text-amber-400' : 'text-stone-200'}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z" />
    </svg>
  ));

const ProductDetailPage = () => {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { detail: product, detailLoading } = useSelector((state) => state.product);
  const { token } = useSelector((state) => state.auth);
  const isWished = useSelector(selectIsWishlisted(product?.id));

  const [mainImage, setMainImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [selectedVar, setSelectedVar] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [review, setReview] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(fetchProductBySlug(slug));
    setMainImage(0);
    setQty(1);
    setSelectedVar(null);
    setActiveTab('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [dispatch, slug]);

  useEffect(() => {
    if (product?.id) trackView(product.id);
  }, [product?.id]);

  useEffect(() => {
    const availableStock = selectedVar?.stock ?? product?.stock ?? 1;
    if (availableStock <= 0) {
      setQty(1);
      return;
    }
    setQty((current) => Math.min(current, availableStock));
  }, [selectedVar?.stock, product?.stock]);

  if (detailLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-stone-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-stone-50">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="font-heading text-3xl text-stone-900">Không tìm thấy sản phẩm</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-stone-500">
            Sản phẩm bạn đang xem không còn tồn tại hoặc chưa được đồng bộ dữ liệu.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => navigate('/products')}>
            Quay lại danh sách sản phẩm
          </Button>
        </div>
      </div>
    );
  }

  const images = product.images || [];
  const variants = product.variants || [];
  const reviews = product.reviews || [];
  const related = product.related || [];
  const availableStock = selectedVar?.stock ?? product.stock ?? 0;
  const displayPrice = selectedVar?.price ?? product.sale_price ?? product.price;
  const averageRating = reviews.length
    ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length
    : 0;

  const descriptionData = buildDescriptionData(product.description || '');
  const detailItems = [...descriptionData.detailItems];
  if (product.material && !detailItems.some((item) => item.value === product.material)) {
    detailItems.unshift({ label: 'Chất liệu tổng quan', value: product.material });
  }

  const quickFacts = [
    { label: 'Danh mục', value: product.category_name || 'Đang cập nhật' },
    { label: 'Chất liệu', value: product.material || 'Đang cập nhật' },
    { label: 'Tồn kho', value: availableStock > 0 ? `${availableStock} sản phẩm` : 'Hết hàng' },
    { label: 'Đã bán', value: `${product.sold || 0} sản phẩm` },
  ];

  const handleAddCart = () => {
    if (!token) {
      navigate('/login');
      return;
    }

    dispatch(
      addToCart({
        product_id: product.id,
        variant_id: selectedVar?.id,
        quantity: qty,
      })
    );
    dispatch(openCart());
  };

  const handleBuyNow = () => {
    handleAddCart();
    navigate('/checkout');
  };

  const handleReview = async (event) => {
    event.preventDefault();
    if (!token) {
      navigate('/login');
      return;
    }

    setSubmitting(true);
    try {
      await reviewAPI.add(product.id, review);
      toast.success('Đã ghi nhận đánh giá của bạn.');
      setReview({ rating: 5, comment: '' });
      dispatch(fetchProductBySlug(slug));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <section className="border-b border-stone-200 bg-[radial-gradient(circle_at_top_left,_rgba(208,190,157,0.35),_transparent_30%),linear-gradient(180deg,_#fffdf8_0%,_#f6f1e8_100%)]">
        <div className="container mx-auto px-4 py-8 md:py-10">
          <Breadcrumb
            items={[
              { label: 'Trang chủ', to: '/' },
              { label: 'Sản phẩm', to: '/products' },
              { label: product.name },
            ]}
          />

          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-stone-500">
              {product.category_name}
            </p>
            <h1 className="font-heading text-3xl leading-tight text-stone-900 md:text-5xl">
              {product.name}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-stone-600 md:text-base">
              {descriptionData.overviewParagraphs[0] || 'Thông tin chi tiết của sản phẩm đang được cập nhật.'}
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-10 md:py-12">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-[96px_minmax(0,1fr)]">
              {images.length > 1 && (
                <div className="order-2 flex gap-3 overflow-x-auto pb-2 lg:order-1 lg:flex-col lg:overflow-visible">
                  {images.map((image, index) => (
                    <button
                      key={`${image.url}-${index}`}
                      type="button"
                      onClick={() => setMainImage(index)}
                      className={`h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl border transition-all ${
                        index === mainImage
                          ? 'border-stone-900 shadow-[0_8px_24px_rgba(28,25,23,0.08)]'
                          : 'border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      <img src={image.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <motion.div
                key={images[mainImage]?.url || 'placeholder'}
                initial={{ opacity: 0.4, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="order-1 overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_20px_60px_rgba(28,25,23,0.06)] lg:order-2"
              >
                <div className="aspect-[4/4.4] bg-[linear-gradient(180deg,_#f8f5ef_0%,_#efe7da_100%)]">
                  <img
                    src={images[mainImage]?.url || '/placeholder.jpg'}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              </motion.div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {PURCHASE_POINTS.map((item) => (
                <div key={item.title} className="rounded-[24px] border border-stone-200 bg-white p-5">
                  <h2 className="font-heading text-lg text-stone-900">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="xl:sticky xl:top-24">
            <div className="space-y-6 rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_20px_60px_rgba(28,25,23,0.08)] md:p-7">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge color={availableStock > 0 ? 'green' : 'red'}>
                    {availableStock > 0 ? 'Còn hàng' : 'Hết hàng'}
                  </Badge>
                  {product.is_featured ? <Badge color="primary">Nổi bật</Badge> : null}
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <span className="font-heading text-4xl text-stone-900">{formatPrice(displayPrice)}</span>
                  {product.sale_price ? (
                    <span className="pb-1 text-lg text-stone-400 line-through">
                      {formatPrice(product.price)}
                    </span>
                  ) : null}
                </div>

                <p className="text-sm leading-6 text-stone-500">
                  Đã bao gồm VAT. Giá hiển thị theo cấu hình hiện tại của sản phẩm.
                </p>
              </div>

              {averageRating > 0 ? (
                <div className="flex items-center gap-3 rounded-2xl bg-stone-50 px-4 py-3">
                  <div className="flex items-center gap-1">{renderRatingStars(averageRating)}</div>
                  <span className="text-sm text-stone-600">
                    {averageRating.toFixed(1)} trên 5 ({reviews.length} đánh giá)
                  </span>
                </div>
              ) : null}

              {product.material ? (
                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
                  <span className="font-medium text-stone-900">Chất liệu:</span> {product.material}
                </div>
              ) : null}

              {variants.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-stone-900">Tùy chọn phiên bản</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((variant) => {
                      const label = [variant.color, variant.size].filter(Boolean).join(' · ');
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => setSelectedVar(variant.id === selectedVar?.id ? null : variant)}
                          className={`rounded-full border px-4 py-2 text-sm transition-all ${
                            selectedVar?.id === variant.id
                              ? 'border-stone-900 bg-stone-900 text-white'
                              : 'border-stone-200 text-stone-700 hover:border-stone-500'
                          } ${variant.stock === 0 ? 'cursor-not-allowed opacity-40' : ''}`}
                          disabled={variant.stock === 0}
                        >
                          {label || `Phiên bản ${variant.id}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="text-sm font-medium text-stone-900">Số lượng</p>
                <div className="flex items-center justify-between rounded-2xl border border-stone-200 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setQty((current) => Math.max(1, current - 1))}
                    className="h-10 w-10 rounded-full text-xl text-stone-700 transition-colors hover:bg-stone-100"
                  >
                    -
                  </button>
                  <span className="text-base font-medium text-stone-900">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty((current) => Math.min(Math.max(availableStock, 1), current + 1))}
                    className="h-10 w-10 rounded-full text-xl text-stone-700 transition-colors hover:bg-stone-100"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleBuyNow}
                  disabled={availableStock === 0}
                >
                  Mua ngay
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={handleAddCart}
                  disabled={availableStock === 0}
                >
                  {availableStock === 0 ? 'Hết hàng' : 'Thêm vào giỏ'}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    if (!token) {
                      navigate('/login');
                      return;
                    }
                    dispatch(toggleWishlist(product.id));
                  }}
                  className={`flex w-full items-center justify-center rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                    isWished
                      ? 'border-rose-200 bg-rose-50 text-rose-600'
                      : 'border-stone-200 text-stone-700 hover:border-stone-500'
                  }`}
                >
                  {isWished ? 'Đã lưu vào yêu thích' : 'Lưu vào yêu thích'}
                </button>

                <a
                  href="/contact"
                  className="flex w-full items-center justify-center rounded-2xl border border-stone-200 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:border-stone-500"
                >
                  Liên hệ tư vấn
                </a>
              </div>

              <div className="rounded-2xl bg-stone-900 px-5 py-5 text-sm leading-6 text-stone-200">
                <h2 className="font-heading text-lg text-white">Thông tin mua hàng</h2>
                <ul className="mt-3 space-y-2">
                  {SERVICE_POLICIES.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-12">
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="flex gap-6 overflow-x-auto border-b border-stone-200">
              {[
                { key: 'overview', label: 'Mô tả' },
                { key: 'details', label: 'Thông tin sản phẩm' },
                { key: 'reviews', label: `Đánh giá (${reviews.length})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap border-b-2 pb-4 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'border-stone-900 text-stone-900'
                      : 'border-transparent text-stone-400 hover:text-stone-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="pt-8">
              {activeTab === 'overview' ? (
                <div className="space-y-8">
                  <div className="space-y-4 text-base leading-8 text-stone-600">
                    {descriptionData.overviewParagraphs.length > 0 ? (
                      descriptionData.overviewParagraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))
                    ) : (
                      <p>Thông tin mô tả đang được cập nhật.</p>
                    )}
                  </div>

                  {descriptionData.supplementaryNote ? (
                    <div className="rounded-[24px] border border-stone-200 bg-white p-6">
                      <h2 className="font-heading text-xl text-stone-900">Ghi chú bổ sung</h2>
                      <p className="mt-3 text-sm leading-7 text-stone-600">
                        {descriptionData.supplementaryNote}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === 'details' ? (
                <div className="space-y-8">
                  <div className="grid gap-4 md:grid-cols-2">
                    {detailItems.length > 0 ? (
                      detailItems.map((item) => (
                        <div key={`${item.label}-${item.value}`} className="rounded-[24px] border border-stone-200 bg-white p-5">
                          <p className="text-xs font-medium uppercase tracking-[0.25em] text-stone-400">
                            {item.label}
                          </p>
                          <p className="mt-3 text-base leading-7 text-stone-800">{item.value}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[24px] border border-stone-200 bg-white p-5 text-sm leading-7 text-stone-600">
                        Thông tin cấu hình chi tiết của sản phẩm đang được cập nhật thêm.
                      </div>
                    )}
                  </div>

                  <div className="rounded-[24px] border border-stone-200 bg-stone-900 p-6 text-stone-100">
                    <h2 className="font-heading text-xl">Chính sách đi kèm</h2>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      {PURCHASE_POINTS.map((item) => (
                        <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-stone-300">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'reviews' ? (
                <div className="space-y-8">
                  {reviews.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-stone-300 bg-white p-8 text-sm text-stone-500">
                      Chưa có đánh giá nào cho sản phẩm này.
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {reviews.map((item) => (
                        <div key={item.id} className="rounded-[24px] border border-stone-200 bg-white p-5">
                          <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white">
                              {item.user_name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-stone-900">{item.user_name}</p>
                                  <div className="mt-1 flex items-center gap-1">
                                    {renderRatingStars(item.rating, 'w-3.5 h-3.5')}
                                  </div>
                                </div>
                              </div>
                              <p className="mt-3 text-sm leading-7 text-stone-600">{item.comment}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {token ? (
                    <form onSubmit={handleReview} className="rounded-[24px] border border-stone-200 bg-white p-6">
                      <h2 className="font-heading text-xl text-stone-900">Gửi đánh giá</h2>
                      <div className="mt-4 flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReview({ ...review, rating: star })}
                            className="transition-transform hover:scale-105"
                          >
                            {renderRatingStars(star <= review.rating ? 1 : 0, 'w-7 h-7')[0]}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={review.comment}
                        onChange={(event) => setReview({ ...review, comment: event.target.value })}
                        placeholder="Nhận xét của bạn về sản phẩm"
                        rows={5}
                        className="mt-4 w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm text-stone-700 outline-none transition-colors focus:border-stone-500"
                      />
                      <Button type="submit" variant="primary" className="mt-4" loading={submitting}>
                        Gửi đánh giá
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}


            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[24px] border border-stone-200 bg-white p-6">
              <h2 className="font-heading text-xl text-stone-900">Thông tin nhanh</h2>
              <dl className="mt-4 space-y-4">
                {quickFacts.map((item) => (
                  <div key={item.label} className="border-b border-stone-100 pb-4 last:border-b-0 last:pb-0">
                    <dt className="text-xs font-medium uppercase tracking-[0.22em] text-stone-400">
                      {item.label}
                    </dt>
                    <dd className="mt-2 text-sm leading-7 text-stone-700">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f5efe4_100%)] p-6">
              <h2 className="font-heading text-xl text-stone-900">Hỗ trợ mua hàng</h2>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                Nếu bạn cần phối màu, đổi chất liệu hoặc xem thêm ảnh thực tế, đội ngũ tư vấn có thể hỗ trợ trực tiếp.
              </p>
              <a
                href="/contact"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-700"
              >
                Gửi yêu cầu tư vấn
              </a>
            </div>
          </aside>
        </div>
      </section>

      <SimilarProducts productId={product.id} className="container mx-auto px-4 pb-4" />
      <div className="container mx-auto px-4 pb-8">
        <CoPurchaseSection productId={product.id} limit={8} />
      </div>

      {related.length > 0 ? (
        <section className="container mx-auto px-4 pb-16">
          <div className="mb-6">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-stone-500">Cùng danh mục</p>
            <h2 className="mt-2 font-heading text-2xl text-stone-900">Sản phẩm liên quan</h2>
          </div>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4 md:gap-6">
            {related.map((item, index) => (
              <ProductCard key={item.id} product={item} index={index} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default ProductDetailPage;
