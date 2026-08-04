import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Phone, Mail, MapPin,
  RefreshCw, X, ShoppingBag, ChevronDown, Clock,
  CheckCircle2, ChefHat, Truck, XCircle, Package, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import socket from '../../lib/socket';
import Spinner from '../../components/ui/Spinner';
import Badge, { orderStatusVariant, orderStatusLabel } from '../../components/ui/Badge';

const STATUS_OPTIONS = [
  { value: '',                label: 'All Orders' },
  { value: 'PENDING',         label: 'Pending' },
  { value: 'APPROVED',        label: 'Approved' },
  { value: 'PREPARING',       label: 'Preparing' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
  { value: 'DELIVERED',       label: 'Delivered' },
  { value: 'REJECTED',        label: 'Rejected' },
];

const STATUS_UPDATE_OPTIONS = [
  { value: 'APPROVED',         label: '✅ Approved',          color: 'text-blue-600   bg-blue-50   border-blue-200' },
  { value: 'PREPARING',        label: '👨‍🍳 Preparing',        color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { value: 'OUT_FOR_DELIVERY', label: '🛵 Out for Delivery',  color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { value: 'DELIVERED',        label: '🎉 Delivered',         color: 'text-green-600  bg-green-50  border-green-200' },
  { value: 'REJECTED',         label: '❌ Rejected',          color: 'text-red-600    bg-red-50    border-red-200' },
];

const statusIcon = (s) => {
  const map = { PENDING: Clock, APPROVED: CheckCircle2, PREPARING: ChefHat, OUT_FOR_DELIVERY: Truck, DELIVERED: CheckCircle2, REJECTED: XCircle };
  const Icon = map[s] || Package;
  return <Icon size={14} />;
};

// ── Status Dropdown — exported for Dashboard use ──────────────────────────────
export const StatusDropdown = ({ currentStatus, orderId, onUpdated }) => {
  const [open,     setOpen]     = useState(false);
  const [updating, setUpdating] = useState(false);

  const PENDING_COLOR = 'text-amber-600 bg-amber-50 border-amber-200';
  const current = currentStatus === 'PENDING'
    ? { value: 'PENDING', label: '🕐 Pending', color: PENDING_COLOR }
    : STATUS_UPDATE_OPTIONS.find((o) => o.value === currentStatus);

  const update = async (value) => {
    if (value === currentStatus) { setOpen(false); return; }
    setUpdating(true);
    setOpen(false);
    try {
      const res = await api.patch(`/orders/admin/${orderId}/status`, { status: value });
      onUpdated(res.data.data.order);
      toast.success(`Status → ${orderStatusLabel(value)}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={updating}
        style={{ minHeight: 'unset', minWidth: 'unset' }}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${current?.color || 'bg-gray-50 border-gray-200 text-gray-600'} ${updating ? 'opacity-60' : 'hover:opacity-80'}`}
      >
        {updating ? <RefreshCw size={12} className="animate-spin" /> : statusIcon(currentStatus)}
        {orderStatusLabel(currentStatus)}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden min-w-[210px]">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 pt-3 pb-1">Update Status</p>
            {STATUS_UPDATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => update(opt.value)}
                style={{ minHeight: 'unset', minWidth: 'unset' }}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-orange-50 ${
                  opt.value === currentStatus ? 'bg-orange-50 text-orange-600 font-bold' : 'text-gray-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.value === currentStatus ? 'bg-orange-500' : 'bg-gray-200'}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ── Admin Payment Verify/Reject Actions ──────────────────────────────────────
const AdminPaymentActions = ({ orderId, onUpdated }) => {
  const [loading,      setLoading]      = useState(null); // 'verify' | 'reject'
  const [rejectNote,   setRejectNote]   = useState('');
  const [showReject,   setShowReject]   = useState(false);

  const verify = async () => {
    setLoading('verify');
    try {
      await api.post(`/payments/admin/verify/${orderId}`);
      const res = await api.get(`/orders/admin/${orderId}`);
      onUpdated?.(res.data.data.order);
      toast.success('Payment verified! Order approved.');
    } catch (err) { toast.error(err.message); }
    finally { setLoading(null); }
  };

  const reject = async () => {
    setLoading('reject');
    try {
      await api.post(`/payments/admin/reject/${orderId}`, { note: rejectNote });
      const res = await api.get(`/orders/admin/${orderId}`);
      onUpdated?.(res.data.data.order);
      toast.success('Payment rejected. Customer notified.');
      setShowReject(false);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(null); }
  };

  if (showReject) {
    return (
      <div className="space-y-2">
        <textarea
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Rejection reason (optional)..."
          rows={2}
          className="w-full text-sm border border-red-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
        />
        <div className="flex gap-2">
          <button onClick={() => setShowReject(false)}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={reject} disabled={loading === 'reject'}
            className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-60">
            {loading === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button onClick={verify} disabled={!!loading}
        className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 disabled:opacity-60 flex items-center justify-center gap-1.5">
        {loading === 'verify' ? <RefreshCw size={14} className="animate-spin" /> : '✅'}
        Verify Payment
      </button>
      <button onClick={() => setShowReject(true)} disabled={!!loading}
        className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-bold hover:bg-red-100 disabled:opacity-60">
        ❌ Reject
      </button>
    </div>
  );
};

// ── Order Detail Modal — exported for Dashboard use ──────────────────────────
export const OrderDetailModal = ({ orderId, onClose, onUpdated, onDeleted }) => {
  const [order,    setOrder]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/orders/admin/${orderId}`)
      .then((r) => setOrder(r.data.data.order))
      .catch(() => onClose())
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleStatusUpdate = (updated) => {
    setOrder(updated);
    onUpdated?.(updated);
  };

  const handlePaymentUpdate = async () => {
    // Refetch full order to get updated payment info
    try {
      const res = await api.get(`/orders/admin/${orderId}`);
      setOrder(res.data.data.order);
      onUpdated?.(res.data.data.order);
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Order #${order.id} permanently delete ho jayega. Confirm?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/orders/admin/${order.id}`);
      toast.success(`Order #${order.id} delete ho gaya.`);
      onDeleted?.(order.id);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Delete failed.');
      setDeleting(false);
    }
  };

  // Close on backdrop click
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  if (!orderId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdrop}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col z-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <ShoppingBag size={16} className="text-orange-500" />
            </div>
            <div>
              <h2 className="font-extrabold text-gray-900 text-base">
                Order #{order?.id || '...'}
              </h2>
              {order && (
                <p className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleString('en-PK', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Delete button */}
            {order && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ minHeight: 'unset', minWidth: 'unset' }}
                className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors disabled:opacity-50"
                title="Delete order"
              >
                {deleting
                  ? <RefreshCw size={15} className="animate-spin text-red-400" />
                  : <Trash2 size={15} className="text-red-500" />}
              </button>
            )}
            <button
              onClick={onClose}
              style={{ minHeight: 'unset', minWidth: 'unset' }}
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : !order ? null : (
          <div className="overflow-y-auto flex-1 pb-6">

            {/* ── Status + Update ── */}
            <div className="px-5 pt-4">
              <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Current Status</p>
                  <Badge variant={orderStatusVariant(order.status)} className="text-xs px-3 py-1">
                    {statusIcon(order.status)}
                    <span className="ml-1.5">{orderStatusLabel(order.status)}</span>
                  </Badge>
                </div>
                <StatusDropdown
                  currentStatus={order.status}
                  orderId={order.id}
                  onUpdated={handleStatusUpdate}
                />
              </div>
            </div>

            {/* ── Customer Details ── */}
            <div className="px-5 mt-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Customer</p>
              <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0">
                    {order.user?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{order.user?.name}</p>
                    <p className="text-xs text-gray-400">{order.paymentType === 'COD' ? '💵 Cash on Delivery' : '💳 Online Payment'}</p>
                  </div>
                </div>
                {order.user?.phone && (
                  <a href={`tel:${order.user.phone}`} className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-orange-500 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Phone size={13} className="text-green-500" />
                    </div>
                    {order.user.phone}
                  </a>
                )}
                {order.user?.email && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-600">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Mail size={13} className="text-blue-500" />
                    </div>
                    {order.user.email}
                  </div>
                )}
                <div className="flex items-start gap-2.5 text-sm text-gray-600">
                  <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin size={13} className="text-orange-500" />
                  </div>
                  <span className="leading-relaxed">{order.address}</span>
                </div>
                {order.notes && (() => {
                  const userNote = order.notes.split(' | ').find((n) => !n.startsWith('[Deal:'));
                  return userNote ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-sm text-amber-700 italic">
                      📝 {userNote}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>

            {/* ── Order Items ── */}
            {(() => {
              const items = order.items || [];

              // Separate regular items from deal items
              const regularItems = items.filter((i) => !i.dealId);

              // Group deal items by dealCartKey (each unique key = one deal instance)
              const dealGroups = {};
              items.filter((i) => i.dealId).forEach((i) => {
                const key = i.dealCartKey || String(i.dealId);
                if (!dealGroups[key]) {
                  dealGroups[key] = { dealId: i.dealId, dealTitle: i.dealTitle, items: [] };
                }
                dealGroups[key].items.push(i);
              });
              const dealGroupList = Object.values(dealGroups);

              // Bill summary rows — deals show as one line per deal group
              const billRows = [
                ...regularItems.map((i) => ({
                  label: `${i.product?.name || i.customName || 'Item'} × ${i.quantity}`,
                  amount: Number(i.priceAtOrder) * i.quantity,
                })),
                ...dealGroupList.map((g) => {
                  const total = g.items.reduce((s, i) => s + Number(i.priceAtOrder) * i.quantity, 0);
                  return { label: `🎁 ${g.dealTitle} (deal)`, amount: total };
                }),
              ];

              const itemCount = regularItems.length + dealGroupList.length;

              return (
                <div className="px-5 mt-4">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                    Order Items ({itemCount})
                  </p>
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

                    {/* Regular items */}
                    {regularItems.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-3.5 ${
                          idx !== regularItems.length - 1 || dealGroupList.length > 0 ? 'border-b border-gray-50' : ''
                        }`}
                      >
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-orange-50 flex-shrink-0">
                          {item.product?.imageUrl
                            ? <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.product?.name || item.customName || 'Item'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Rs. {Number(item.priceAtOrder).toLocaleString()} × {item.quantity}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                          Rs. {(Number(item.priceAtOrder) * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    ))}

                    {/* Deal groups */}
                    {dealGroupList.map((group, gIdx) => {
                      const dealTotal = group.items.reduce(
                        (s, i) => s + Number(i.priceAtOrder) * i.quantity, 0
                      );
                      return (
                        <div
                          key={group.dealId + '_' + gIdx}
                          className={`px-4 py-3.5 ${gIdx !== dealGroupList.length - 1 ? 'border-b border-gray-50' : ''}`}
                        >
                          {/* Deal header row */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 text-lg">
                                🎁
                              </div>
                              <div>
                                <p className="text-sm font-bold text-orange-600">{group.dealTitle}</p>
                                <p className="text-xs text-orange-400 mt-0.5">Deal</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                              Rs. {dealTotal.toLocaleString()}
                            </p>
                          </div>
                          {/* Deal contents */}
                          <div className="ml-13 pl-1 space-y-1 border-l-2 border-orange-100 ml-[52px]">
                            {group.items.map((item) => (
                              <div key={item.id} className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg overflow-hidden bg-orange-50 flex-shrink-0">
                                  {item.product?.imageUrl
                                    ? <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center text-[10px]">🍽️</div>}
                                </div>
                                <p className="text-xs text-gray-600 flex-1 truncate">
                                  {item.product?.name || item.customName || 'Item'}
                                </p>
                                <p className="text-xs text-gray-400 flex-shrink-0">× {item.quantity}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {/* Bill summary */}
                    <div className="bg-gray-50 px-4 py-3.5 space-y-1.5 border-t border-gray-100">
                      {billRows.map((row, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-500">
                          <span>{row.label}</span>
                          <span>Rs. {row.amount.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-900">Total Bill</span>
                        <span className="text-lg font-extrabold text-orange-600">
                          Rs. {Number(order.totalAmount).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Payment Info ── */}
            <div className="px-5 mt-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Payment</p>
              <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {order.paymentType === 'COD' ? '💵 Cash on Delivery' : '💳 Online (EasyPaisa)'}
                    </p>
                    {order.payment?.transactionId && (
                      <p className="text-xs text-gray-400 mt-0.5">TXN: {order.payment.transactionId}</p>
                    )}
                  </div>
                  <Badge variant={order.payment?.status === 'COMPLETED' ? 'success' : order.payment?.status === 'FAILED' ? 'danger' : 'warning'}>
                    {order.payment?.status || 'PENDING'}
                  </Badge>
                </div>

                {/* Screenshot */}
                {order.paymentType === 'ONLINE' && order.payment?.screenshotUrl && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 mb-1.5">Payment Screenshot</p>
                    <a href={order.payment.screenshotUrl} target="_blank" rel="noreferrer">
                      <img src={order.payment.screenshotUrl} alt="Payment screenshot"
                        className="w-full max-h-64 object-contain rounded-xl border border-gray-200 hover:opacity-90 transition-opacity" />
                    </a>
                    <p className="text-xs text-gray-400 mt-1">Tap image to view full size</p>
                  </div>
                )}

                {/* No screenshot yet */}
                {order.paymentType === 'ONLINE' && !order.payment?.screenshotUrl && order.payment?.status !== 'COMPLETED' && (
                  <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">
                    ⏳ Waiting for customer to upload payment screenshot…
                  </p>
                )}

                {/* Admin rejection note */}
                {order.payment?.adminNote && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">
                    ❌ Rejection note: {order.payment.adminNote}
                  </p>
                )}

                {/* Verify / Reject buttons */}
                {order.paymentType === 'ONLINE' &&
                 order.payment?.screenshotUrl &&
                 order.payment?.status === 'PENDING' && (
                  <AdminPaymentActions orderId={order.id} onUpdated={handlePaymentUpdate} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Orders List Page ──────────────────────────────────────────────────────────
const AdminOrdersPage = () => {
  const [orders,          setOrders]         = useState([]);
  const [total,           setTotal]          = useState(0);
  const [loading,         setLoading]        = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [searchParams,    setSearchParams]   = useSearchParams();

  const status = searchParams.get('status') || '';
  const page   = Number(searchParams.get('page') || 1);
  const LIMIT  = 15;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (status) params.set('status', status);
      const res = await api.get(`/orders/admin?${params}`);
      setOrders(res.data.data.orders);
      setTotal(res.data.data.total);
    } catch { /* keep */ }
    finally { setLoading(false); }
  }, [status, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Real-time: new order or status update ──────────────────────────────────
  useEffect(() => {
    const handleNewOrder = () => {
      // Refresh list so new order appears (only on page 1 or PENDING filter)
      if (page === 1) fetchOrders();
    };

    const handleStatusUpdate = ({ id, status: newStatus }) => {
      setOrders((prev) =>
        prev.map((o) => o.id === id ? { ...o, status: newStatus } : o)
      );
    };

    const handleScreenshotUploaded = ({ orderId }) => {
      toast('📸 Payment screenshot received for Order #' + orderId, { icon: '💳', duration: 5000 });
      fetchOrders();
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_status_updated', handleStatusUpdate);
    socket.on('payment_screenshot_uploaded', handleScreenshotUploaded);
    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_updated', handleStatusUpdate);
      socket.off('payment_screenshot_uploaded', handleScreenshotUploaded);
    };
  }, [fetchOrders, page]);

  const setStatus = (s) => {
    const p = new URLSearchParams();
    if (s) p.set('status', s);
    p.set('page', '1');
    setSearchParams(p);
  };

  const setPage = (p) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  };

  // Update order in list after status change from modal
  const handleModalUpdate = (updated) => {
    setOrders((prev) => prev.map((o) => o.id === updated.id ? { ...o, status: updated.status } : o));
  };

  // Remove order from list after delete
  const handleModalDelete = (deletedId) => {
    setOrders((prev) => prev.filter((o) => o.id !== deletedId));
    setTotal((prev) => prev - 1);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-500 px-3 py-2 rounded-xl hover:bg-orange-50 min-h-[44px]"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors min-h-[40px] ${
                status === value
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-orange-50 border border-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No orders found.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Items</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Payment</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className="hover:bg-orange-50/30 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-3.5 font-bold text-gray-900">#{order.id}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-gray-900">{order.user?.name}</p>
                          <p className="text-xs text-gray-400">{order.user?.phone || order.user?.email}</p>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 max-w-[160px]">
                          <p className="truncate text-xs">
                            {(() => {
                              const seen = new Set();
                              return order.items.map((i) => {
                                if (i.dealId) {
                                  if (seen.has(i.dealCartKey || i.dealId)) return null;
                                  seen.add(i.dealCartKey || i.dealId);
                                  return `🎁 ${i.dealTitle}`;
                                }
                                return i.product?.name || i.customName;
                              }).filter(Boolean).join(', ');
                            })()}
                          </p>
                          <p className="text-xs text-gray-400">{order.items.length} item(s)</p>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-gray-900">
                          Rs. {Number(order.totalAmount).toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {order.paymentType === 'COD' ? 'Cash' : 'Online'}
                        </td>
                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <StatusDropdown
                            currentStatus={order.status}
                            orderId={order.id}
                            onUpdated={(updated) => setOrders((prev) => prev.map((o) => o.id === updated.id ? { ...o, status: updated.status } : o))}
                          />
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">
                          {new Date(order.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                          {' '}
                          {new Date(order.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <button
                      onClick={() => setSelectedOrderId(order.id)}
                      style={{ minHeight: 'unset', minWidth: 'unset' }}
                      className="text-left flex-1"
                    >
                      <p className="font-bold text-gray-900">#{order.id} — {order.user?.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(order.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">
                        {(() => {
                          const seen = new Set();
                          return order.items.map((i) => {
                            if (i.dealId) {
                              if (seen.has(i.dealCartKey || i.dealId)) return null;
                              seen.add(i.dealCartKey || i.dealId);
                              return `🎁 ${i.dealTitle}`;
                            }
                            return i.product?.name || i.customName;
                          }).filter(Boolean).join(', ');
                        })()}
                      </p>
                    </button>
                    <p className="font-bold text-orange-600 text-sm flex-shrink-0 ml-2">
                      Rs. {Number(order.totalAmount).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <button
                      onClick={() => setSelectedOrderId(order.id)}
                      style={{ minHeight: 'unset', minWidth: 'unset' }}
                      className="text-xs text-orange-500 font-semibold hover:underline"
                    >
                      View Details →
                    </button>
                    <StatusDropdown
                      currentStatus={order.status}
                      orderId={order.id}
                      onUpdated={(updated) => setOrders((prev) => prev.map((o) => o.id === updated.id ? { ...o, status: updated.status } : o))}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-gray-500">Page {page} of {totalPages} ({total} orders)</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)} disabled={page === 1}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-orange-50 disabled:opacity-40 min-h-[40px] min-w-[40px] flex items-center justify-center"
                  ><ChevronLeft size={16} /></button>
                  <button
                    onClick={() => setPage(page + 1)} disabled={page >= totalPages}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-orange-50 disabled:opacity-40 min-h-[40px] min-w-[40px] flex items-center justify-center"
                  ><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdated={handleModalUpdate}
          onDeleted={handleModalDelete}
        />
      )}
    </>
  );
};

export default AdminOrdersPage;
