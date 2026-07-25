import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Package, ChevronRight, ArrowLeft, Clock, CheckCircle, Truck, XCircle, ChefHat } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import socket from '../../lib/socket';
import Spinner from '../../components/ui/Spinner';
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

// ── Single order detail view ─────────────────────────────────────────────────
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
          const label = orderStatusLabel(status);
          toast(`📦 Order status updated: ${label}`, { id: 'order-status', duration: 5000 });
          return { ...prev, status };
        });
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

      {/* Rejected notice */}
      {order.status === 'REJECTED' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
          <p className="text-red-700 font-medium text-sm flex items-center gap-2">
            <XCircle size={16} /> This order was rejected. Please contact us for more info.
          </p>
        </div>
      )}

      {/* Delivery address */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-bold text-gray-900 text-sm mb-2">Delivery Address</h2>
        <p className="text-gray-600 text-sm">{order.address}</p>
        {order.notes && (() => {
          // Show only the user's personal note, not the deal summary part
          const userNote = order.notes.split(' | ').find((n) => !n.startsWith('[Deal:'));
          return userNote ? (
            <p className="text-gray-400 text-xs mt-2 italic">Note: {userNote}</p>
          ) : null;
        })()}
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <h2 className="font-bold text-gray-900 text-sm mb-3">Items Ordered</h2>
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-orange-50 flex-shrink-0">
                {item.product?.imageUrl ? (
                  <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.product?.name}</p>
                <p className="text-xs text-gray-400">
                  Rs. {Number(item.priceAtOrder).toLocaleString()} × {item.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                Rs. {(Number(item.priceAtOrder) * item.quantity).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Deal summary — parsed from notes field */}
        {order.notes && order.notes.includes('[Deal:') && (() => {
          // Extract deal lines from notes (format: "[Deal: Title] item1 ×1, item2 ×2")
          const dealLines = order.notes.split(' | ').filter((n) => n.startsWith('[Deal:'));
          const userNote  = order.notes.split(' | ').find((n) => !n.startsWith('[Deal:'));
          return (
            <>
              {dealLines.map((line, idx) => {
                const match = line.match(/^\[Deal: (.+?)\] (.+)$/);
                if (!match) return null;
                const [, dealTitle, itemsStr] = match;
                const dealItemsList = itemsStr.split(', ');
                return (
                  <div key={idx} className="mt-3 pt-3 border-t border-dashed border-orange-200 bg-orange-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-orange-600 mb-1.5">🎁 {dealTitle}</p>
                    <div className="space-y-0.5">
                      {dealItemsList.map((it, i) => (
                        <p key={i} className="text-xs text-gray-600 flex items-center gap-1">
                          <span className="text-orange-400">•</span> {it}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
              {userNote && (
                <p className="text-gray-400 text-xs mt-2 italic">Note: {userNote}</p>
              )}
            </>
          );
        })()}

        <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between">
          <span className="font-bold text-gray-900">Total</span>
          <span className="font-extrabold text-orange-600">
            Rs. {Number(order.totalAmount).toLocaleString()}
          </span>
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
                  {order.items.map((i) => i.product?.name).join(', ')}
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
