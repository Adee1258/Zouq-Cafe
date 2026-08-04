import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Package, ChevronRight, ArrowLeft, Clock, CheckCircle, Truck, XCircle, ChefHat, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import socket from '../../lib/socket';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge, { orderStatusVariant, orderStatusLabel } from '../../components/ui/Badge';
// ── Order status stepper ─────────────────────────────────────────────────────
const STATUS_STEPS = ['PENDING', 'APPROVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const StatusIcon = ({ status }) => {
  const icons = {
    PENDING: <Clock size={16} />,
    APPROVED: <CheckCircle size={16} />,
    PREPARING: <ChefHat size={16} />,
    OUT_FOR_DELIVERY: <Truck size={16} />,
    DELIVERED: <CheckCircle size={16} />,
    REJECTED: <XCircle size={16} />,
  };
  return icons[status] || <Package size={16} />;
};

// ── Payment Screenshot Upload (for ONLINE pending payments) ──────────────────
const PaymentScreenshotSection = ({ order }) => {
  const [payStatus,    setPayStatus]    = useState(null);
  const [epInfo,       setEpInfo]       = useState(null);
  const [screenshot,   setScreenshot]   = useState(null);
  const [preview,      setPreview]      = useState(null);
  const [uploading,    setUploading]    = useState(false);
  const [uploaded,     setUploaded]     = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (order.paymentType !== 'ONLINE') return;
    Promise.all([
      api.get(`/payments/status/${order.id}`),
      api.get('/payments/easypaisa-number'),
    ]).then(([sRes, epRes]) => {
      setPayStatus(sRes.data.data);
      setEpInfo(epRes.data.data);
      if (sRes.data.data?.screenshotUrl) setUploaded(true);
    }).catch(() => {});
  }, [order.id, order.paymentType]);

  if (order.paymentType !== 'ONLINE') return null;
  if (!payStatus && !epInfo) return null;

  const status = payStatus?.status;

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    setScreenshot(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!screenshot) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('screenshot', screenshot);
      await api.post(`/payments/screenshot/${order.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploaded(true);
      setPayStatus((p) => ({ ...p, status: 'PENDING' }));
      toast.success('Screenshot uploaded! Awaiting verification.');
    } catch (err) { toast.error(err.message || 'Upload failed.'); }
    finally { setUploading(false); }
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm mt-4">
      <h2 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
        💳 EasyPaisa Payment
      </h2>

      {/* Status badge */}
      {status === 'COMPLETED' && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 mb-3">
          <CheckCircle size={18} className="text-green-500" />
          <div>
            <p className="font-bold text-green-700 text-sm">Payment Verified ✅</p>
            <p className="text-xs text-green-600">Your payment has been confirmed by admin.</p>
          </div>
        </div>
      )}

      {status === 'FAILED' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-3">
          <p className="font-bold text-red-600 text-sm">Payment Rejected ❌</p>
          {payStatus?.adminNote && (
            <p className="text-xs text-red-500 mt-1">{payStatus.adminNote}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">Please re-upload your screenshot.</p>
        </div>
      )}

      {/* Show EasyPaisa number if not yet verified */}
      {status !== 'COMPLETED' && epInfo?.number && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-3">
          <p className="text-xs text-gray-500 mb-1">Send payment to:</p>
          <p className="text-lg font-extrabold text-gray-900">{epInfo.number}</p>
          <p className="text-xs text-gray-500">{epInfo.accountName}</p>
          <p className="text-sm font-bold text-orange-600 mt-1">Amount: Rs. {Number(order.totalAmount).toLocaleString()}</p>
        </div>
      )}

      {/* Upload section — show if not verified */}
      {status !== 'COMPLETED' && (
        <>
          {(uploaded && status === 'PENDING') ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
              <p className="text-sm font-bold text-blue-700">Screenshot Submitted</p>
              <p className="text-xs text-blue-600 mt-1">Waiting for admin verification…</p>
              {payStatus?.screenshotUrl && (
                <a href={payStatus.screenshotUrl} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-500 underline mt-1 inline-block">View submitted screenshot</a>
              )}
            </div>
          ) : (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl cursor-pointer mb-3 transition-colors ${
                  preview ? 'border-orange-300' : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                {preview ? (
                  <img src={preview} alt="screenshot" className="w-full max-h-48 object-contain rounded-xl" />
                ) : (
                  <div className="flex flex-col items-center py-6 text-gray-400 gap-1">
                    <Upload size={22} />
                    <p className="text-sm">Upload payment screenshot</p>
                    <p className="text-xs">JPG/PNG, max 5MB</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <Button variant="primary" fullWidth onClick={handleUpload}
                disabled={!screenshot} isLoading={uploading}>
                <Upload size={14} className="mr-2" /> Submit Screenshot
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
const OrderDetail = ({ orderId }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const fetchOrder = () =>
      api.get(`/orders/my/${orderId}`)
        .then((r) => { if (mounted) setOrder(r.data.data.order); })
        .catch(() => { if (mounted) navigate('/orders', { replace: true }); })
        .finally(() => { if (mounted) setLoading(false); });

    fetchOrder();
    // Poll every 30s as fallback
    const interval = setInterval(fetchOrder, 30000);

    // Real-time: update status instantly when admin changes it
    const handleStatusUpdate = ({ id, status }) => {
      if (Number(id) === Number(orderId)) {
        setOrder((prev) => {
          if (!prev) return prev;
          return { ...prev, status };
        });
        // Toast outside of setState to avoid setState-during-render warning
        const label = orderStatusLabel(status);
        setTimeout(() => {
          toast(`📦 Order status updated: ${label}`, { id: 'order-status', duration: 5000 });
        }, 0);
      }
    };

    socket.on('order_status_updated', handleStatusUpdate);

    return () => {
      mounted = false;
      clearInterval(interval);
      socket.off('order_status_updated', handleStatusUpdate);
    };
  }, [orderId, navigate]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      await api.patch(`/orders/my/${orderId}/cancel`);
      toast.success('Order cancelled successfully.');
      setOrder((prev) => prev ? { ...prev, status: 'REJECTED' } : prev);
    } catch (err) {
      toast.error(err.message || 'Could not cancel order.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!order) return null;

  const stepIndex = STATUS_STEPS.indexOf(order.status);

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <button
        onClick={() => navigate('/orders')}
        className="flex items-center gap-2 text-gray-500 hover:text-orange-500 text-sm font-medium mb-5 min-h-[44px]"
      >
        <ArrowLeft size={18} /> All Orders
      </button>

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order #{order.id}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date(order.createdAt).toLocaleDateString('en-PK', {
              day: 'numeric', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
        <Badge variant={orderStatusVariant(order.status)}>
          <StatusIcon status={order.status} />
          <span className="ml-1">{orderStatusLabel(order.status)}</span>
        </Badge>
      </div>

      {/* Cancel button — only visible when order is still PENDING */}
      {order.status === 'PENDING' && (
        <div className="mb-4">
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="w-full flex items-center justify-center gap-2 border-2 border-red-200 text-red-500 font-semibold py-3 rounded-2xl hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle size={16} />
            {cancelling ? 'Cancelling...' : 'Cancel Order'}
          </button>
        </div>
      )}

      {/* Status stepper — hidden for rejected orders */}
      {order.status !== 'REJECTED' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <h2 className="font-bold text-gray-900 text-sm mb-4">Order Status</h2>
          <div className="relative">
            {/* Progress line */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200">
              <div
                className="h-full bg-orange-500 transition-all duration-500"
                style={{ width: `${Math.max(0, (stepIndex / (STATUS_STEPS.length - 1)) * 100)}%` }}
              />
            </div>

            <div className="flex justify-between relative">
              {STATUS_STEPS.map((step, idx) => {
                const done = idx <= stepIndex;
                const active = idx === stepIndex;
                return (
                  <div key={step} className="flex flex-col items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-colors ${
                      done ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-400'
                    } ${active ? 'ring-4 ring-orange-100' : ''}`}>
                      <StatusIcon status={step} />
                    </div>
                    <span className={`text-[10px] text-center font-medium leading-tight max-w-[52px] ${
                      done ? 'text-orange-600' : 'text-gray-400'
                    }`}>
                      {orderStatusLabel(step)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Rejected / Cancelled notice */}
      {order.status === 'REJECTED' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
          <p className="text-red-700 font-medium text-sm flex items-center gap-2">
            <XCircle size={16} />
            {/* If the customer cancelled it themselves it was PENDING → REJECTED.
                If admin rejected it, it could have been any earlier status. */}
            This order was cancelled or rejected. Please contact us if you have questions.
          </p>
        </div>
      )}

      {/* Delivery address */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-bold text-gray-900 text-sm mb-2">Delivery Address</h2>
        <p className="text-gray-600 text-sm">{order.address}</p>
        {order.notes && (() => {
          const userNote = order.notes.split(' | ').find((n) => !n.startsWith('[Deal:'));
          return userNote ? (
            <p className="text-gray-400 text-xs mt-2 italic">Note: {userNote}</p>
          ) : null;
        })()}
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-bold text-gray-900 text-sm mb-3">Items Ordered</h2>

        {(() => {
          const items = order.items || [];
          const regularItems  = items.filter((i) => !i.dealId);
          const dealGroups    = {};
          items.filter((i) => i.dealId).forEach((i) => {
            const key = i.dealCartKey || String(i.dealId);
            if (!dealGroups[key]) {
              dealGroups[key] = { dealId: i.dealId, dealTitle: i.dealTitle, items: [] };
            }
            dealGroups[key].items.push(i);
          });
          const dealGroupList = Object.values(dealGroups);

          return (
            <div className="space-y-3">
              {/* ── Regular food items ── */}
              {regularItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-orange-50 flex-shrink-0">
                    {item.product?.imageUrl ? (
                      <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.product?.name || item.customName || 'Item'}
                    </p>
                    <p className="text-xs text-gray-400">
                      Rs. {Number(item.priceAtOrder).toLocaleString()} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                    Rs. {(Number(item.priceAtOrder) * item.quantity).toLocaleString()}
                  </p>
                </div>
              ))}

              {/* ── Deal groups ── */}
              {dealGroupList.map((group, gIdx) => {
                const dealTotal = group.items.reduce(
                  (s, i) => s + Number(i.priceAtOrder) * i.quantity, 0
                );
                return (
                  <div
                    key={group.dealId + '_' + gIdx}
                    className="bg-orange-50 border border-orange-100 rounded-xl p-3"
                  >
                    {/* Deal header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎁</span>
                        <div>
                          <p className="text-sm font-bold text-orange-600">{group.dealTitle}</p>
                          <p className="text-[11px] text-orange-400">Deal</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        Rs. {dealTotal.toLocaleString()}
                      </p>
                    </div>
                    {/* Deal contents */}
                    <div className="space-y-1.5 pl-1 border-l-2 border-orange-200 ml-1">
                      {group.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md overflow-hidden bg-white flex-shrink-0">
                            {item.product?.imageUrl ? (
                              <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px]">🍽️</div>
                            )}
                          </div>
                          <p className="text-xs text-gray-700 flex-1 truncate">
                            {item.product?.name || item.customName || 'Item'}
                          </p>
                          <p className="text-xs text-gray-500 flex-shrink-0">× {item.quantity}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div className="border-t border-gray-100 mt-4 pt-4 space-y-2">
          {Number(order.discountAmount) > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>Rs. {(Number(order.totalAmount) + Number(order.discountAmount)).toLocaleString()}</span>
              </div>
              {/* Promo code discount — only shown when a promo was applied */}
              {order.promoCode && (
                <div className="flex justify-between text-sm text-green-600 font-semibold">
                  <span className="flex items-center gap-1">🏷️ Promo ({order.promoCode})</span>
                  {/* discountAmount includes both promo + points. Show full discount
                      here since we can't split them post-hoc without extra fields. */}
                  <span>− Rs. {Number(order.discountAmount).toLocaleString()}</span>
                </div>
              )}
              {/* Points redemption — shown when no promo code but discount exists */}
              {!order.promoCode && Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-sm text-amber-600 font-semibold">
                  <span className="flex items-center gap-1">⭐ Points Redeemed</span>
                  <span>− Rs. {Number(order.discountAmount).toLocaleString()}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-extrabold text-orange-600">
              Rs. {Number(order.totalAmount).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="font-bold text-gray-900 text-sm mb-2">Payment</h2>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Method</span>
          <span className="font-medium">{order.paymentType === 'COD' ? 'Cash on Delivery' : 'Online'}</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className="text-gray-600">Status</span>
          <Badge variant={order.payment?.status === 'COMPLETED' ? 'success' : 'warning'}>
            {order.payment?.status || 'Pending'}
          </Badge>
        </div>
      </div>

      {/* EasyPaisa screenshot upload */}
      <PaymentScreenshotSection order={order} />
    </div>
  );
};

// ── Orders list view ─────────────────────────────────────────────────────────
const OrdersList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders/my')
      .then((r) => setOrders(r.data.data.orders))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-gray-500 font-medium">No orders yet</p>
          <p className="text-gray-400 text-sm mt-1 mb-6">Place your first order today!</p>
          <Link
            to="/menu"
            className="bg-orange-500 text-white font-bold px-8 py-3 rounded-xl hover:bg-orange-600 transition-colors"
          >
            Browse Menu
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="block bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99]"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-bold text-gray-900">Order #{order.id}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString('en-PK', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <Badge variant={orderStatusVariant(order.status)}>
                  {orderStatusLabel(order.status)}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 truncate max-w-[70%]">
                  {(() => {
                    const seen = new Set();
                    return order.items
                      .map((i) => {
                        if (i.dealId) {
                          // Show deal title once per deal group
                          if (seen.has(i.dealCartKey || i.dealId)) return null;
                          seen.add(i.dealCartKey || i.dealId);
                          return `🎁 ${i.dealTitle}`;
                        }
                        return i.product?.name || i.customName;
                      })
                      .filter(Boolean)
                      .join(', ');
                  })()}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-orange-600 text-sm">
                    Rs. {Number(order.totalAmount).toLocaleString()}
                  </span>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Router wrapper — shows list or detail based on URL param ─────────────────
const OrdersPage = () => {
  const { id } = useParams();
  return id ? <OrderDetail orderId={id} /> : <OrdersList />;
};

export default OrdersPage;
