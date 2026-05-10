import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clearCart, selectCartItems, selectCartSubtotal } from '../store/slices/cartSlice';
import { orderAPI, voucherAPI, paymentAPI } from '../services/api';
import { formatPrice } from '../utils/format';
import { Button, Input, Breadcrumb } from '../components/common';
import toast from 'react-hot-toast';

const PAYMENT_METHODS = [
  { value: 'cod',   label: 'Thanh toán khi nhận hàng (COD)', icon: '💵' },
  { value: 'vnpay', label: 'Thanh toán qua VNPay',            icon: '🏦' },
  { value: 'momo',  label: 'Ví MoMo',                         icon: '💜' },
];

// ─── Validators ───────────────────────────────────────────────────────────────
const PHONE_RE  = /^(0|\+84)(3|5|7|8|9)\d{8}$/;

const PROVINCES = [
  'An Giang','Bà Rịa - Vũng Tàu','Bắc Giang','Bắc Kạn','Bạc Liêu','Bắc Ninh',
  'Bến Tre','Bình Định','Bình Dương','Bình Phước','Bình Thuận','Cà Mau',
  'Cần Thơ','Cao Bằng','Đà Nẵng','Đắk Lắk','Đắk Nông','Điện Biên',
  'Đồng Nai','Đồng Tháp','Gia Lai','Hà Giang','Hà Nam','Hà Nội','Hà Tĩnh',
  'Hải Dương','Hải Phòng','Hậu Giang','Hòa Bình','Hưng Yên','Khánh Hòa',
  'Kiên Giang','Kon Tum','Lai Châu','Lâm Đồng','Lạng Sơn','Lào Cai',
  'Long An','Nam Định','Nghệ An','Ninh Bình','Ninh Thuận','Phú Thọ',
  'Phú Yên','Quảng Bình','Quảng Nam','Quảng Ngãi','Quảng Ninh','Quảng Trị',
  'Sóc Trăng','Sơn La','Tây Ninh','Thái Bình','Thái Nguyên','Thanh Hóa',
  'Thừa Thiên Huế','Tiền Giang','TP. Hồ Chí Minh','Trà Vinh','Tuyên Quang',
  'Vĩnh Long','Vĩnh Phúc','Yên Bái',
];

const validate = (form) => {
  const errs = {};

  if (!form.shipping_name.trim())
    errs.shipping_name = 'Vui lòng nhập họ tên';
  else if (form.shipping_name.trim().length < 3)
    errs.shipping_name = 'Họ tên tối thiểu 3 ký tự';

  if (!form.shipping_phone.trim())
    errs.shipping_phone = 'Vui lòng nhập số điện thoại';
  else if (!PHONE_RE.test(form.shipping_phone.replace(/\s/g, '')))
    errs.shipping_phone = 'Số điện thoại không hợp lệ (VD: 0912345678)';

  if (!form.province)
    errs.province = 'Vui lòng chọn tỉnh / thành phố';

  if (!form.district.trim())
    errs.district = 'Vui lòng nhập quận / huyện';
  else if (form.district.trim().length < 2)
    errs.district = 'Quận / huyện không hợp lệ';

  if (!form.ward.trim())
    errs.ward = 'Vui lòng nhập phường / xã';
  else if (form.ward.trim().length < 2)
    errs.ward = 'Phường / xã không hợp lệ';

  if (!form.detail.trim())
    errs.detail = 'Vui lòng nhập địa chỉ chi tiết';
  else if (form.detail.trim().length < 5)
    errs.detail = 'Địa chỉ chi tiết quá ngắn';

  return errs;
};

// ─── Error message helper ─────────────────────────────────────────────────────
const ErrMsg = ({ msg }) =>
  msg ? <p className="text-xs text-red-500 mt-1">{msg}</p> : null;

// ─── Main Component ───────────────────────────────────────────────────────────
const CheckoutPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const items    = useSelector(selectCartItems);
  const subtotal = useSelector(selectCartSubtotal);
  const { user } = useSelector((s) => s.auth);

  const [form, setForm] = useState({
    shipping_name:  user?.name  || '',
    shipping_phone: user?.phone || '',
    province: '', district: '', ward: '', detail: '',
    payment_method: 'cod',
    note: '',
  });
  const [errors,       setErrors]       = useState({});
  const [voucher,      setVoucher]      = useState('');
  const [voucherInfo,  setVoucherInfo]  = useState(null);
  const [voucherError, setVoucherError] = useState('');
  const [loading,      setLoading]      = useState(false);

  const shipping_fee = subtotal >= 5000000 ? 0 : 50000;
  const discount     = voucherInfo?.discount || 0;
  const total        = subtotal + shipping_fee - discount;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // Xóa error khi user sửa field
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  const handleCheckVoucher = async () => {
    if (!voucher.trim()) return;
    try {
      setVoucherError('');
      const res = await voucherAPI.check({ code: voucher, subtotal });
      setVoucherInfo(res.data);
      toast.success(`Áp dụng mã giảm ${formatPrice(res.data.discount)} thành công!`);
    } catch (err) {
      setVoucherError(err.message);
      setVoucherInfo(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) { toast.error('Giỏ hàng trống'); return; }

    // Validate
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      // Scroll đến lỗi đầu tiên
      const firstKey = Object.keys(errs)[0];
      document.querySelector(`[name="${firstKey}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setLoading(true);
    try {
      const shipping_addr = `${form.detail}, ${form.ward}, ${form.district}, ${form.province}`;
      const payload = {
        items: items.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity:   i.quantity,
        })),
        shipping_name:  form.shipping_name.trim(),
        shipping_phone: form.shipping_phone.trim(),
        shipping_addr,
        payment_method: form.payment_method,
        note:           form.note,
        voucher_code:   voucherInfo ? voucher : undefined,
      };

      const res = await orderAPI.create(payload);
      const { order_code, order_id, payment_method } = res.data;

      if (payment_method === 'vnpay') {
        const payRes = await paymentAPI.createVnpayUrl({ order_code, amount: total });
        dispatch(clearCart());
        window.location.href = payRes.data.payment_url;
        return;
      }

      if (payment_method === 'momo') {
        const payRes = await paymentAPI.createMomoUrl({ order_code, amount: total });
        dispatch(clearCart());
        window.location.href = payRes.data.payment_url;
        return;
      }

      // COD
      dispatch(clearCart());
      toast.success('Đặt hàng thành công!');
      navigate(`/orders/${order_id}?success=1`);
    } catch (err) {
      toast.error(err.message || 'Đặt hàng thất bại');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) { navigate('/cart'); return null; }

  const fieldCls = (name) =>
    `w-full px-3 py-2.5 border rounded-sm text-sm focus:outline-none transition-colors ${
      errors[name]
        ? 'border-red-400 focus:border-red-500'
        : 'border-gray-300 focus:border-primary-500'
    }`;

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Giỏ hàng', to: '/cart' }, { label: 'Thanh toán' }]} />
      <h1 className="font-heading text-3xl mb-8">Thanh toán</h1>

      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* ── Left ── */}
        <div className="lg:col-span-3 space-y-8">

          {/* Shipping */}
          <div className="bg-white rounded-sm border border-gray-100 p-6 space-y-5">
            <h2 className="font-heading text-lg">Thông tin giao hàng</h2>
            <div className="grid grid-cols-2 gap-4">

              {/* Họ tên */}
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Họ tên người nhận *</label>
                <input name="shipping_name" value={form.shipping_name} onChange={handleChange}
                  className={fieldCls('shipping_name')} placeholder="Nguyễn Văn A" />
                <ErrMsg msg={errors.shipping_name} />
              </div>

              {/* SĐT */}
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Số điện thoại *</label>
                <input name="shipping_phone" value={form.shipping_phone} onChange={handleChange}
                  className={fieldCls('shipping_phone')} placeholder="0912345678" />
                <ErrMsg msg={errors.shipping_phone} />
              </div>

              {/* Tỉnh / Thành phố — dropdown */}
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Tỉnh / Thành phố *</label>
                <select name="province" value={form.province} onChange={handleChange}
                  className={fieldCls('province')}>
                  <option value="">-- Chọn tỉnh / thành phố --</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <ErrMsg msg={errors.province} />
              </div>

              {/* Quận / Huyện */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Quận / Huyện *</label>
                <input name="district" value={form.district} onChange={handleChange}
                  className={fieldCls('district')} placeholder="VD: Quận 1" />
                <ErrMsg msg={errors.district} />
              </div>

              {/* Phường / Xã */}
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Phường / Xã *</label>
                <input name="ward" value={form.ward} onChange={handleChange}
                  className={fieldCls('ward')} placeholder="VD: Phường Bến Nghé" />
                <ErrMsg msg={errors.ward} />
              </div>

              {/* Địa chỉ chi tiết */}
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Số nhà, tên đường *</label>
                <input name="detail" value={form.detail} onChange={handleChange}
                  className={fieldCls('detail')} placeholder="VD: 12 Lê Lợi" />
                <ErrMsg msg={errors.detail} />
              </div>

              {/* Ghi chú */}
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Ghi chú</label>
                <textarea name="note" value={form.note} onChange={handleChange}
                  rows={3} placeholder="Ghi chú cho đơn hàng (không bắt buộc)"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-sm text-sm focus:outline-none focus:border-primary-500 resize-none" />
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-heading text-lg">Phương thức thanh toán</h2>
            {PAYMENT_METHODS.map((m) => (
              <label key={m.value}
                className={`flex items-center gap-4 p-4 border rounded-sm cursor-pointer transition-all ${
                  form.payment_method === m.value
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <input type="radio" name="payment_method" value={m.value}
                  checked={form.payment_method === m.value} onChange={handleChange}
                  className="text-primary-500" />
                <span className="text-xl">{m.icon}</span>
                <span className="text-sm font-medium">{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Right: Order Summary ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-sm border border-gray-100 p-6 sticky top-24">
            <h2 className="font-heading text-lg mb-5">Đơn hàng ({items.length} sản phẩm)</h2>

            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="w-16 h-16 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                    <img src={item.image || '/placeholder.jpg'} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">x{item.quantity}</p>
                    <p className="text-sm font-semibold text-primary-600 mt-1">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>

            <hr className="my-5" />

            {/* Voucher */}
            <div className="mb-5">
              <label className="text-sm font-medium text-gray-700 block mb-2">Mã giảm giá</label>
              <div className="flex gap-2">
                <input type="text" value={voucher}
                  onChange={(e) => setVoucher(e.target.value.toUpperCase())}
                  placeholder="Nhập mã..."
                  className="flex-1 border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary-500" />
                <button type="button" onClick={handleCheckVoucher}
                  className="px-4 py-2 bg-dark text-white text-sm rounded-sm hover:bg-primary-500 transition-colors">
                  Áp dụng
                </button>
              </div>
              {voucherError && <p className="text-xs text-red-500 mt-1">{voucherError}</p>}
              {voucherInfo  && <p className="text-xs text-green-600 mt-1">✓ Giảm {formatPrice(voucherInfo.discount)}</p>}
            </div>

            {/* Totals */}
            <div className="space-y-2 text-sm mb-6">
              <div className="flex justify-between text-gray-500">
                <span>Tạm tính</span><span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Phí vận chuyển</span>
                <span>{shipping_fee === 0
                  ? <span className="text-green-500">Miễn phí</span>
                  : formatPrice(shipping_fee)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Giảm giá</span><span>-{formatPrice(discount)}</span>
                </div>
              )}
              <hr />
              <div className="flex justify-between font-semibold text-base text-dark">
                <span>Tổng cộng</span>
                <span className="font-heading text-xl">{formatPrice(total)}</span>
              </div>
            </div>

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              ĐẶT HÀNG NGAY
            </Button>
            <p className="text-xs text-gray-400 text-center mt-3">
              Bằng cách đặt hàng, bạn đồng ý với chính sách của chúng tôi
            </p>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CheckoutPage;
