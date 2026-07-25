import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, CreditCard, Banknote, Lock, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import useCartStore from '../../stores/cartStore';
import useAuthStore from '../../stores/authStore';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const CheckoutPage = () => {
  const { user } = useAuthStore();
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.totalPrice());
  const clearCart = useCartStore((s) => s.clearCart);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    address: user?.address || '',
    notes: '',
    paymentType: 'COD',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [epData, setEpData]   = useState(null); // EasyPaisa gateway params

  // Redirect if cart is empty
  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
        <Link to="/menu" className="text-orange-500 font-semibold hover:underline">
          Go back to menu
        </Link>
      </div>
    );
  }

  // Redirect if not logged in
  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Login required</h1>
        <p className="text-gray-500 mb-6">Please login to place your order.</p>
        <Link
          to="/login"
          state={{ from: { pathname: '/checkout' } }}
          className="bg-orange-500 text-white font-bold px-8 py-3 rounded-xl hover:bg-orange-600 transition-colors"
        >
          Login
        </Link>
      </div>
    );
  }

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
      const payload = {
        // Flatten cart: regular items + deal bundle items both become order items
        items: items.flatMap((i) => {
          if (i.isDeal && i.dealItems?.length > 0) {
            // Deal bundle — send menu items with productId, and custom items with customPrice
            return i.dealItems.map((di) => {
              if (di.productId) {
                return {
                  productId: di.productId,
                  quantity:  di.quantity * i.quantity,
                };
              } else {
                // Custom deal item — no productId, pass name and price
                return {
                  productId:   null,
                  quantity:    di.quantity * i.quantity,
                  customName:  di.customName,
                  customPrice: di.customPrice,
                };
              }
            });
          }
          return [{ productId: i.id, quantity: i.quantity }];
        }),
        address:     form.address.trim(),
        notes:       form.notes.trim() || undefined,
        paymentType: form.paymentType,
        // Pass deal price override so backend uses the correct deal price
        dealOverrides: items
          .filter((i) => i.isDeal)
          .map((i) => ({
            dealId:       i.dealId,
            dealPrice:    i.price,       // price per single deal bundle
            cartQuantity: i.quantity,    // how many times this deal was added
          })),
      };

      const res = await api.post('/orders', payload);
      const order = res.data.data.order;

      if (form.paymentType === 'ONLINE') {
        try {
          const payRes = await api.post('/payments/initiate', { orderId: order.id });
          const ep = payRes.data.data;

          // Clear cart before redirect — user is leaving the page
          clearCart();

          // Store orderId so PaymentResultPage can poll status on return
          sessionStorage.setItem('ep_pending_order', order.id);

          // Build a hidden form and auto-submit it to EasyPaisa gateway
          // EasyPaisa requires a POST with these fields — we can't use fetch/redirect
          setEpData({ ...ep, orderId: order.id });
          // Form submission happens after state update via useEffect inside render
          toast('Redirecting to EasyPaisa...', { icon: '💳', duration: 2000 });
          // Short delay so toast shows, then form auto-submits (see hidden form below)
        } catch (payErr) {
          toast('Order placed! Complete payment below.', { icon: '⚠️' });
          clearCart();
          navigate(`/orders/${order.id}`, { replace: true });
        }
      } else {
        toast.success('Order placed! Pay on delivery 🎉');
        clearCart();
        navigate(`/orders/${order.id}`, { replace: true });
      }
    } catch (err) {
      // Order creation failed — do NOT clear cart so user can retry
      toast.error(err.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      {/* Hidden EasyPaisa auto-submit form — submits automatically when epData is set */}
      {epData && (
        <form
          method="POST"
          action={epData.gatewayUrl}
          style={{ display: 'none' }}
          ref={(formEl) => { if (formEl) formEl.submit(); }}
        >
          <input type="hidden" name="storeId"         value={epData.storeId} />
          <input type="hidden" name="amount"          value={epData.amount} />
          <input type="hidden" name="postBackURL"     value={epData.postBackURL} />
          <input type="hidden" name="orderDesc"       value={epData.orderDesc} />
          <input type="hidden" name="tansactionType"  value="InitialRequest" />
          <input type="hidden" name="merchantOrderId" value={epData.merchantOrderId} />
          <input type="hidden" name="expiryDate"      value={epData.expiryDate} />
          <input type="hidden" name="tokenExpiry"     value={epData.tokenExpiry} />
          <input type="hidden" name="successUrl"      value={epData.successUrl} />
          <input type="hidden" name="failureUrl"      value={epData.failureUrl} />
          <input type="hidden" name="hash"            value={epData.hash} />
        </form>
      )}
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-orange-500 text-sm font-medium mb-5 min-h-[44px]"
      >
        <ArrowLeft size={18} /> Back to Cart
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Delivery Address ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-orange-500" /> Delivery Address
          </h2>
          <Input
            label="Full address"
            placeholder="House #, Street, Area, City"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            error={errors.address}
            required
            icon={MapPin}
          />
          <div className="mt-3">
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Order notes (optional)
            </label>
            <textarea
              placeholder="Special instructions, e.g. 'extra spicy', 'no onions'..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* ── Payment Method ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard size={18} className="text-orange-500" /> Payment Method
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Cash on Delivery */}
            <button
              type="button"
              onClick={() => setForm({ ...form, paymentType: 'COD' })}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                form.paymentType === 'COD'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                form.paymentType === 'COD' ? 'bg-orange-500' : 'bg-gray-100'
              }`}>
                <Banknote size={20} className={form.paymentType === 'COD' ? 'text-white' : 'text-gray-500'} />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">Cash on Delivery</p>
                <p className="text-xs text-gray-400">Pay when your order arrives</p>
              </div>
              {form.paymentType === 'COD' && (
                <div className="ml-auto w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>

            {/* Online Payment */}
            <button
              type="button"
              onClick={() => setForm({ ...form, paymentType: 'ONLINE' })}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                form.paymentType === 'ONLINE'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                form.paymentType === 'ONLINE' ? 'bg-orange-500' : 'bg-gray-100'
              }`}>
                <CreditCard size={20} className={form.paymentType === 'ONLINE' ? 'text-white' : 'text-gray-500'} />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">Online Payment</p>
                <p className="text-xs text-gray-400">Pay via EasyPaisa</p>
              </div>
              {form.paymentType === 'ONLINE' && (
                <div className="ml-auto w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          </div>

          {form.paymentType === 'ONLINE' && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <span className="text-lg">💚</span>
              <span>
                After placing order, you'll be redirected to <strong>EasyPaisa</strong> to complete payment securely.
              </span>
            </div>
          )}
        </div>

        {/* ── Order Summary ── */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Order Summary</h2>
          <div className="space-y-2.5">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600 flex-1 truncate pr-2">
                  {item.name}
                  <span className="text-gray-400 ml-1">× {item.quantity}</span>
                </span>
                <span className="font-medium text-gray-900 flex-shrink-0">
                  Rs. {(Number(item.price) * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-3 flex justify-between">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-extrabold text-orange-600 text-lg">
                Rs. {totalPrice.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ── Place Order Button ── */}
        <div className="sticky bottom-20 md:bottom-4 left-0 right-0 pb-2">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            size="lg"
            isLoading={loading}
            className="shadow-xl"
          >
            <Lock size={16} className="mr-2" />
            Place Order — Rs. {totalPrice.toLocaleString()}
          </Button>
          <p className="text-center text-xs text-gray-400 mt-2 flex items-center justify-center gap-1">
            <Lock size={10} /> Your order is secure and confirmed via SMS
          </p>
        </div>
      </form>
    </div>
  );
};

export default CheckoutPage;
