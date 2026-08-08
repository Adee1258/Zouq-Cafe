import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, CreditCard, Banknote, Lock, ArrowLeft, Tag, X, CheckCircle, Loader2, Star, Gift, Phone, Upload, Copy, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import useCartStore from '../../stores/cartStore';
import useAuthStore from '../../stores/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const CheckoutPage = () => {
  const { user, updateUser } = useAuthStore();
  const items      = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.totalPrice());
  const clearCart  = useCartStore((s) => s.clearCart);
  const navigate   = useNavigate();

  const [form, setForm] = useState({
    address:     user?.address || '',
    notes:       '',
    paymentType: 'COD',
  });
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(false);
  const [saveAddress, setSaveAddress] = useState(false);
  const [deliveryArea, setDeliveryArea] = useState('inside'); // 'inside' | 'outside'
  const DELIVERY_CHARGES = { inside: 50, outside: 150 };

  // ── After order placed (ONLINE) ────────────────────────────────────────────
  const [placedOrder,   setPlacedOrder]   = useState(null);   // order just placed
  const [epInfo,        setEpInfo]        = useState(null);   // { number, accountName }
  const [screenshot,    setScreenshot]    = useState(null);   // File object
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploaded,      setUploaded]      = useState(false);
  const screenshotRef = useRef();

  // ── Promo state ────────────────────────────────────────────────────────────
  const [promoInput,   setPromoInput]   = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult,  setPromoResult]  = useState(null);
  const [promoError,   setPromoError]   = useState('');
  const promoDebounce = useRef(null);

  // ── Loyalty points state ───────────────────────────────────────────────────
  const [loyaltyBalance,  setLoyaltyBalance]  = useState(null); // { pointsBalance, redeemValue, monetaryValue }
  const [redeemInput,     setRedeemInput]      = useState('');
  const [redeemApplied,   setRedeemApplied]    = useState(0);   // actual points to redeem
  const [redeemDiscount,  setRedeemDiscount]   = useState(0);   // Rs discount from points

  // Fetch loyalty balance on mount
  useEffect(() => {
    if (!user) return;
    api.get('/loyalty/balance').then((r) => setLoyaltyBalance(r.data.data)).catch(() => {});
  }, [user]);

  // Fetch EasyPaisa number on mount
  useEffect(() => {
    api.get('/payments/easypaisa-number').then((r) => setEpInfo(r.data.data)).catch(() => {});
  }, []);

  // Redirect if cart is empty
  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
        <Link to="/menu" className="text-orange-500 font-semibold hover:underline">Go back to menu</Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Login required</h1>
        <p className="text-gray-500 mb-6">Please login to place your order.</p>
        <Link to="/login" state={{ from: { pathname: '/checkout' } }}
          className="bg-orange-500 text-white font-bold px-8 py-3 rounded-xl hover:bg-orange-600 transition-colors">
          Login
        </Link>
      </div>
    );
  }

  // ── Computed totals ────────────────────────────────────────────────────────
  const deliveryCharge = DELIVERY_CHARGES[deliveryArea] || 50;
  const promoDiscount  = promoResult?.discountAmount || 0;
  const afterPromo     = promoResult ? promoResult.finalTotal : totalPrice;
  const finalTotal     = Math.max(0, afterPromo - redeemDiscount) + deliveryCharge;

  // ── Points helpers ─────────────────────────────────────────────────────────
  const maxRedeemable = loyaltyBalance
    ? Math.min(loyaltyBalance.pointsBalance, Math.ceil(afterPromo / (loyaltyBalance.redeemValue || 1)))
    : 0;

  const handleRedeemInput = (e) => {
    const val = e.target.value;
    setRedeemInput(val);
    const pts = parseInt(val, 10);
    if (!val || isNaN(pts) || pts <= 0) {
      setRedeemApplied(0);
      setRedeemDiscount(0);
      return;
    }
    const capped = Math.min(pts, maxRedeemable);
    setRedeemApplied(capped);
    setRedeemDiscount(capped * (loyaltyBalance?.redeemValue || 1));
  };

  const applyMaxPoints = () => {
    setRedeemInput(String(maxRedeemable));
    setRedeemApplied(maxRedeemable);
    setRedeemDiscount(maxRedeemable * (loyaltyBalance?.redeemValue || 1));
  };

  const removePoints = () => {
    setRedeemInput('');
    setRedeemApplied(0);
    setRedeemDiscount(0);
  };

  // ── Promo helpers ──────────────────────────────────────────────────────────
  const applyPromo = async (code) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setPromoResult(null); setPromoError(''); return; }

    setPromoLoading(true);
    setPromoError('');
    setPromoResult(null);
    try {
      // Send cart items so backend can check item-level restrictions
      const cartPayload = items.map((i) => ({
        productId:  i.id,
        categoryId: i.categoryId,
        price:      i.price,
        quantity:   i.quantity,
      }));
      const res = await api.post('/promo/validate', { code: trimmed, orderTotal: totalPrice, cartItems: cartPayload });
      setPromoResult(res.data.data);
      toast.success(res.data.message);
    } catch (err) {
      setPromoError(err.message || 'Invalid promo code.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handlePromoInput = (e) => {
    const val = e.target.value;
    setPromoInput(val);
    setPromoError('');
    if (promoResult) setPromoResult(null);
    clearTimeout(promoDebounce.current);
    if (val.trim().length >= 3) {
      promoDebounce.current = setTimeout(() => applyPromo(val), 700);
    }
  };

  const removePromo = () => {
    setPromoInput('');
    setPromoResult(null);
    setPromoError('');
    // Reset points redemption too — maxRedeemable changes when promo is removed
    setRedeemInput('');
    setRedeemApplied(0);
    setRedeemDiscount(0);
  };

  const validate = () => {
    const e = {};
    if (!form.address.trim()) e.address = 'Delivery address is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // Build the items array for the backend.
      // Deal items are expanded into their individual components.
      // Custom deal items (no productId) are included with productId explicitly
      // set to null so the backend's optional validator doesn't reject them.
      const orderItems = items.flatMap((i) => {
        if (i.isDeal && i.dealItems?.length > 0) {
          // Each deal item carries dealCartKey so backend can group them
          return i.dealItems.map((di) => {
            if (di.productId) {
              return {
                productId:   di.productId,
                quantity:    di.quantity * i.quantity,
                dealCartKey: i.id,   // cart item id acts as unique deal-instance key
              };
            }
            // Custom deal item — no DB product
            return {
              productId:   null,
              quantity:    di.quantity * i.quantity,
              customName:  di.customName  || '',
              customPrice: di.customPrice || 0,
              dealCartKey: i.id,
            };
          });
        }
        // Regular product
        return [{
          productId:   i.productId || i.id,   // productId set by cartStore, fallback to id for old items
          variantId:   i.variantId || null,
          quantity:    i.quantity,
        }];
      });

      // Safety check — should never be empty but guard anyway
      if (orderItems.length === 0) {
        toast.error('Your cart is empty.');
        setLoading(false);
        return;
      }

      const payload = {
        items: orderItems,
        address:        form.address.trim(),
        notes:          form.notes.trim() || undefined,
        paymentType:    form.paymentType,
        dealOverrides:  items.filter((i) => i.isDeal).map((i) => ({
          dealId:       i.dealId,
          dealPrice:    i.price,
          cartQuantity: i.quantity,
          cartKey:      i.id,
        })),
        promoCode:      promoResult?.code || undefined,
        redeemPoints:   redeemApplied > 0 ? redeemApplied : undefined,
        deliveryCharge: deliveryCharge,
        deliveryArea:   deliveryArea,
      };

      const res   = await api.post('/orders', payload);
      const order = res.data.data.order;

      // Save address to profile if checkbox ticked and address is different
      if (saveAddress && form.address.trim() && form.address.trim() !== user?.address) {
        try {
          const { data } = await api.patch('/auth/me', { address: form.address.trim() });
          if (data.data?.user) updateUser(data.data.user);
        } catch { /* non-critical */ }
      }

      if (form.paymentType === 'ONLINE') {
        clearCart();
        setPlacedOrder(order);
        toast.success('Order placed! Now send payment on EasyPaisa.');
      } else {
        clearCart();
        toast.success('Order placed! 🎉');
        navigate(`/orders/${order.id}`, { replace: true });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Screenshot upload handler ──────────────────────────────────────────────
  const handleScreenshotChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image too large. Max 5MB.'); return; }
    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const handleUploadScreenshot = async () => {
    if (!screenshot || !placedOrder) return;
    setUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append('screenshot', screenshot);
      await api.post(`/payments/screenshot/${placedOrder.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploaded(true);
      toast.success('Screenshot uploaded! Admin will verify shortly.');
    } catch (err) {
      toast.error(err.message || 'Upload failed. Try again.');
    } finally {
      setUploadLoading(false);
    }
  };

  // ── If ONLINE order just placed → show payment instructions ───────────────
  if (placedOrder) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Order Placed! 🎉</h1>
          <p className="text-gray-500 text-sm mt-1">Order #{placedOrder.id}</p>
        </div>

        {/* Step 1: Pay */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">1</div>
            <h2 className="font-bold text-gray-900">Send Payment on EasyPaisa</h2>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3">
            <p className="text-xs text-green-600 font-semibold mb-1">EasyPaisa Account</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-extrabold text-gray-900 tracking-wider">
                  {epInfo?.number || 'Loading...'}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">{epInfo?.accountName || 'ZOCK Cafe'}</p>
              </div>
              {epInfo?.number && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(epInfo.number);
                    toast.success('Number copied!');
                  }}
                  className="p-2.5 rounded-xl bg-green-100 hover:bg-green-200 transition-colors"
                >
                  <Copy size={18} className="text-green-600" />
                </button>
              )}
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertCircle size={16} className="text-orange-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-orange-700">Amount to Send</p>
              <p className="text-xl font-extrabold text-orange-600">Rs. {Number(placedOrder.totalAmount).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Step 2: Upload screenshot */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">2</div>
            <h2 className="font-bold text-gray-900">Upload Payment Screenshot</h2>
          </div>

          {uploaded ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <CheckCircle size={28} className="text-green-500 mx-auto mb-2" />
              <p className="font-bold text-green-700">Screenshot Uploaded!</p>
              <p className="text-sm text-gray-500 mt-1">Admin will verify your payment shortly. Your order will be approved once verified.</p>
              <button
                onClick={() => navigate(`/orders/${placedOrder.id}`, { replace: true })}
                className="mt-4 bg-orange-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-orange-600 transition-colors"
              >
                Track Order
              </button>
            </div>
          ) : (
            <>
              {/* Upload area */}
              <div
                onClick={() => screenshotRef.current?.click()}
                className={`border-2 border-dashed rounded-xl cursor-pointer transition-colors mb-3 ${
                  screenshotPreview ? 'border-orange-300 bg-orange-50' : 'border-gray-200 hover:border-orange-300 bg-gray-50'
                }`}
              >
                {screenshotPreview ? (
                  <div className="relative">
                    <img src={screenshotPreview} alt="Screenshot" className="w-full max-h-64 object-contain rounded-xl" />
                    <div className="absolute inset-0 bg-black/30 rounded-xl flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <p className="text-white text-sm font-semibold">Click to change</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
                    <Upload size={28} />
                    <p className="text-sm font-medium">Tap to upload screenshot</p>
                    <p className="text-xs">JPG, PNG — Max 5MB</p>
                  </div>
                )}
              </div>
              <input
                ref={screenshotRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleScreenshotChange}
              />

              <Button
                variant="primary"
                fullWidth
                onClick={handleUploadScreenshot}
                disabled={!screenshot}
                isLoading={uploadLoading}
              >
                <Upload size={16} className="mr-2" />
                Submit Screenshot
              </Button>
            </>
          )}
        </div>

        {/* Skip for now */}
        {!uploaded && (
          <button
            onClick={() => navigate(`/orders/${placedOrder.id}`, { replace: true })}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-2"
          >
            Upload later from My Orders →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">

      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-orange-500 text-sm font-medium mb-5 min-h-[44px]">
        <ArrowLeft size={18} /> Back to Cart
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Delivery Address ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-orange-500" /> Delivery Address
          </h2>

          {/* ── Delivery Area Selection ── */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Delivery Area</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'inside',  label: 'Buch Villas',         sub: 'Rs. 50 delivery',  emoji: '📍' },
                { value: 'outside', label: 'Outside Buch Villas', sub: 'Rs. 150 delivery', emoji: '🛵' },
              ].map(({ value, label, sub, emoji }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDeliveryArea(value)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                    deliveryArea === value
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{emoji}</span>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{label}</p>
                    <p className={`text-xs font-semibold ${deliveryArea === value ? 'text-orange-500' : 'text-gray-400'}`}>{sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Saved address quick-fill button */}
          {user?.address && user.address !== form.address && (
            <button
              type="button"
              onClick={() => setForm({ ...form, address: user.address })}
              className="w-full mb-3 flex items-center gap-2.5 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-left hover:bg-orange-100 transition-colors"
            >
              <MapPin size={15} className="text-orange-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-orange-600 mb-0.5">Use saved address</p>
                <p className="text-sm text-gray-700 truncate">{user.address}</p>
              </div>
              <span className="text-xs font-bold text-orange-500 flex-shrink-0">Use →</span>
            </button>
          )}

          {/* Show "using saved" chip when address matches saved */}
          {user?.address && user.address === form.address && (
            <div className="flex items-center gap-2 mb-3 text-xs text-green-600 font-semibold bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <MapPin size={13} /> Using your saved address
            </div>
          )}

          <Input label="Full address" placeholder="House #, Street, Area, City"
            value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
            error={errors.address} required icon={MapPin} />

          {/* Save as default checkbox — only show if address differs from saved */}
          {form.address.trim() && form.address.trim() !== (user?.address || '') && (
            <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(e) => setSaveAddress(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
              />
              <span className="text-sm text-gray-600">Save as my default address</span>
            </label>
          )}

          <div className="mt-3">
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Order notes (optional)</label>
            <textarea placeholder="Special instructions, e.g. 'extra spicy', 'no onions'..."
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none" />
          </div>
        </div>

        {/* ── Loyalty Points ── */}
        {loyaltyBalance && loyaltyBalance.pointsBalance > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Star size={18} className="text-amber-500" /> Loyalty Points
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              You have <strong className="text-amber-600">{loyaltyBalance.pointsBalance} pts</strong>
              {' '}= Rs. {loyaltyBalance.monetaryValue?.toLocaleString()} discount available
            </p>

            {redeemApplied > 0 ? (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <Gift size={18} className="text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-amber-700 text-sm">{redeemApplied} points redeemed</p>
                  <p className="text-xs text-amber-600 font-medium">
                    You save Rs. {redeemDiscount.toLocaleString()}!
                  </p>
                </div>
                <button type="button" onClick={removePoints}
                  className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-500 transition-colors"
                  aria-label="Remove points">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Star size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="number"
                      min="1"
                      max={maxRedeemable}
                      placeholder={`Max ${maxRedeemable} pts`}
                      value={redeemInput}
                      onChange={handleRedeemInput}
                      className="w-full pl-9 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all min-h-[44px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyMaxPoints}
                    className="px-4 py-3 bg-amber-500 text-white font-bold text-sm rounded-xl hover:bg-amber-600 transition-colors min-h-[44px]">
                    Use All
                  </button>
                </div>
                <p className="text-xs text-gray-400 pl-1">
                  1 point = Rs. {loyaltyBalance.redeemValue} discount · Max {maxRedeemable} pts on this order
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Promo Code ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Tag size={18} className="text-orange-500" /> Promo Code
          </h2>

          {promoResult ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-green-700 text-sm">{promoResult.code}</p>
                {promoResult.description && (
                  <p className="text-xs text-green-600">{promoResult.description}</p>
                )}
                <p className="text-xs text-green-600 font-medium mt-0.5">
                  You save Rs. {Math.round(promoResult.discountAmount).toLocaleString()}!
                </p>
              </div>
              <button type="button" onClick={removePromo}
                className="p-1.5 rounded-lg hover:bg-green-100 text-green-500 transition-colors"
                aria-label="Remove promo">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input type="text" placeholder="Enter promo code (e.g. SAVE20)"
                    value={promoInput} onChange={handlePromoInput}
                    className={`w-full pl-9 pr-10 py-3 rounded-xl border text-sm uppercase tracking-wider font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all min-h-[44px] ${
                      promoError ? 'border-red-300 bg-red-50' : 'border-gray-200'
                    }`} />
                  {promoLoading && (
                    <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 animate-spin" />
                  )}
                </div>
                <button type="button" onClick={() => applyPromo(promoInput)}
                  disabled={promoLoading || !promoInput.trim()}
                  className="px-5 py-3 bg-orange-500 text-white font-bold text-sm rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]">
                  Apply
                </button>
              </div>
              {promoError && (
                <p className="text-xs text-red-500 flex items-center gap-1 pl-1">
                  <X size={11} /> {promoError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Payment Method ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard size={18} className="text-orange-500" /> Payment Method
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { type: 'COD',    label: 'Cash on Delivery', sub: 'Pay when your order arrives', Icon: Banknote   },
              { type: 'ONLINE', label: 'Online Payment',   sub: 'Pay via EasyPaisa',            Icon: CreditCard },
            ].map(({ type, label, sub, Icon }) => (
              <button key={type} type="button" onClick={() => setForm({ ...form, paymentType: type })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                  form.paymentType === type ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  form.paymentType === type ? 'bg-orange-500' : 'bg-gray-100'
                }`}>
                  <Icon size={20} className={form.paymentType === type ? 'text-white' : 'text-gray-500'} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{sub}</p>
                </div>
                {form.paymentType === type && (
                  <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
          {form.paymentType === 'ONLINE' && (
            <div className="mt-3 space-y-2">
              {/* EasyPaisa number card */}
              <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Phone size={16} className="text-green-600 flex-shrink-0" />
                  <p className="font-bold text-green-700 text-sm">EasyPaisa Number</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-extrabold text-gray-900 tracking-wider">
                      {epInfo?.number || '0300-8356059'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{epInfo?.accountName || 'ZOCK Cafe'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(epInfo?.number || '03008356059');
                      toast.success('Number copied!');
                    }}
                    className="p-2.5 rounded-xl bg-green-100 hover:bg-green-200 transition-colors flex-shrink-0"
                  >
                    <Copy size={18} className="text-green-600" />
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1">
                  <AlertCircle size={13} /> How to pay:
                </p>
                <ol className="text-xs text-amber-700 space-y-1.5">
                  <li className="flex items-start gap-2"><span className="font-bold flex-shrink-0">1.</span> Order place karo</li>
                  <li className="flex items-start gap-2"><span className="font-bold flex-shrink-0">2.</span> Upar diye number pe EasyPaisa se <strong>exact amount</strong> send karo</li>
                  <li className="flex items-start gap-2"><span className="font-bold flex-shrink-0">3.</span> Payment ka screenshot upload karo</li>
                  <li className="flex items-start gap-2"><span className="font-bold flex-shrink-0">4.</span> Admin verify karega aur order approve ho jayega</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* ── Order Summary ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600 flex-1 truncate pr-2">
                  {item.name} <span className="text-gray-400">× {item.quantity}</span>
                </span>
                <span className="font-medium text-gray-900 flex-shrink-0">
                  Rs. {(Number(item.price) * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>Rs. {totalPrice.toLocaleString()}</span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex justify-between text-sm font-semibold text-green-600">
                  <span className="flex items-center gap-1.5">
                    <Tag size={13} /> Promo ({promoResult.code})
                  </span>
                  <span>− Rs. {Math.round(promoDiscount).toLocaleString()}</span>
                </div>
              )}
              {redeemDiscount > 0 && (
                <div className="flex justify-between text-sm font-semibold text-amber-600">
                  <span className="flex items-center gap-1.5">
                    <Star size={13} /> Points ({redeemApplied} pts)
                  </span>
                  <span>− Rs. {redeemDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  🛵 Delivery ({deliveryArea === 'inside' ? 'Buch Villas' : 'Outside'})
                </span>
                <span>+ Rs. {deliveryCharge}</span>
              </div>
              <div className="flex justify-between font-extrabold text-gray-900 text-base pt-1 border-t border-gray-100">
                <span>Total</span>
                <span className="text-orange-600">Rs. {Math.round(finalTotal).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Place Order ── */}
        <div className="sticky bottom-20 md:bottom-4 pb-2">
          <Button type="submit" variant="primary" fullWidth size="lg" isLoading={loading} className="shadow-xl">
            <Lock size={16} className="mr-2" />
            Place Order — Rs. {Math.round(finalTotal).toLocaleString()}
          </Button>
          <p className="text-center text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
            <Lock size={10} /> Your order is secure and confirmed
          </p>
        </div>

      </form>
    </div>
  );
};

export default CheckoutPage;
