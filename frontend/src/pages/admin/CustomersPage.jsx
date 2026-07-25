import { useState, useEffect, useCallback } from 'react';
import {
  Search, X, Users, Phone, Mail, MapPin,
  ShoppingBag, DollarSign, Calendar, ChevronLeft,
  ChevronRight, RefreshCw, Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import Badge, { orderStatusVariant, orderStatusLabel } from '../../components/ui/Badge';
import { OrderDetailModal } from './OrdersPage';

// ── Customer Detail Modal ─────────────────────────────────────────────────────
const CustomerModal = ({ customerId, onClose }) => {
  const [customer,    setCustomer]   = useState(null);
  const [loading,     setLoading]    = useState(true);
  const [selectedOId, setSelectedOId] = useState(null);

  useEffect(() => {
    api.get(`/admin/customers/${customerId}`)
      .then((r) => setCustomer(r.data.data.customer))
      .catch(() => { toast.error('Failed to load customer.'); onClose(); })
      .finally(() => setLoading(false));
  }, [customerId]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] flex flex-col z-10">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-extrabold text-lg flex-shrink-0">
                {customer?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <h2 className="font-extrabold text-gray-900">{customer?.name || '...'}</h2>
                <p className="text-xs text-gray-400">Customer #{customerId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ minHeight: 'unset', minWidth: 'unset' }}
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : !customer ? null : (
            <div className="overflow-y-auto flex-1 pb-6">

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3 px-5 pt-4">
                <div className="bg-orange-50 rounded-2xl p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingBag size={14} className="text-orange-500" />
                    <p className="text-[11px] font-bold text-orange-500 uppercase tracking-wide">Orders</p>
                  </div>
                  <p className="text-2xl font-extrabold text-orange-700">{customer.orders.length}</p>
                </div>
                <div className="bg-green-50 rounded-2xl p-3.5">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign size={14} className="text-green-500" />
                    <p className="text-[11px] font-bold text-green-500 uppercase tracking-wide">Total Spent</p>
                  </div>
                  <p className="text-lg font-extrabold text-green-700">
                    Rs. {customer.totalSpent.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Contact info */}
              <div className="px-5 mt-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Contact Info</p>
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2.5">
                  {customer.email && (
                    <div className="flex items-center gap-2.5 text-sm text-gray-700">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Mail size={13} className="text-blue-500" />
                      </div>
                      {customer.email}
                    </div>
                  )}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-2.5 text-sm text-gray-700 hover:text-orange-500 transition-colors">
                      <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Phone size={13} className="text-green-500" />
                      </div>
                      {customer.phone}
                    </a>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-2.5 text-sm text-gray-700">
                      <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MapPin size={13} className="text-orange-500" />
                      </div>
                      {customer.address}
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-sm text-gray-400">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <Calendar size={13} className="text-gray-400" />
                    </div>
                    Joined {new Date(customer.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Order history */}
              <div className="px-5 mt-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                  Order History ({customer.orders.length})
                </p>
                {customer.orders.length === 0 ? (
                  <div className="bg-gray-50 rounded-2xl p-6 text-center text-gray-400 text-sm">
                    No orders yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customer.orders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => setSelectedOId(order.id)}
                        style={{ minHeight: 'unset', minWidth: 'unset' }}
                        className="w-full text-left bg-white border border-gray-100 rounded-2xl p-3.5 shadow-sm hover:border-orange-200 hover:bg-orange-50/30 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-gray-900 text-sm">#{order.id}</span>
                              <Badge variant={orderStatusVariant(order.status)} className="text-[10px] px-2 py-0.5">
                                {orderStatusLabel(order.status)}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-400 truncate">
                              {order.items.map((i) => i.product?.name).filter(Boolean).join(', ')}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {new Date(order.createdAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-extrabold text-orange-600 text-sm">
                              Rs. {Number(order.totalAmount).toLocaleString()}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-orange-500 text-xs font-semibold">
                          <Eye size={11} /> View Details
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nested order detail modal */}
      {selectedOId && (
        <OrderDetailModal
          orderId={selectedOId}
          onClose={() => setSelectedOId(null)}
        />
      )}
    </>
  );
};

// ── Main Customers Page ───────────────────────────────────────────────────────
const CustomersPage = () => {
  const [customers,   setCustomers]   = useState([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page,        setPage]        = useState(1);
  const [selectedId,  setSelectedId]  = useState(null);
  const LIMIT = 20;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await api.get(`/admin/customers?${params}`);
      setCustomers(res.data.data.customers);
      setTotal(res.data.data.total);
    } catch {
      toast.error('Failed to load customers.');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users size={20} className="text-orange-500" /> Customers
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{total} registered customer{total !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={fetchCustomers}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-500 px-3 py-2 rounded-xl hover:bg-orange-50 min-h-[44px]"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search by name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-3 rounded-xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ minHeight: 'unset', minWidth: 'unset' }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : customers.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Users size={48} className="mx-auto mb-3 text-gray-200" />
            <p className="font-medium">
              {debouncedSearch ? `No customers match "${debouncedSearch}"` : 'No customers yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Contact</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Orders</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Total Spent</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Joined</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="hover:bg-orange-50/30 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5 text-gray-400 text-xs">#{c.id}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {c.name[0].toUpperCase()}
                          </div>
                          <p className="font-semibold text-gray-900">{c.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-gray-600">{c.email || '—'}</p>
                        <p className="text-xs text-gray-400">{c.phone || '—'}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-600 text-xs font-bold px-2.5 py-1 rounded-full">
                          <ShoppingBag size={11} /> {c.orderCount}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-green-600">
                        Rs. {c.totalSpent.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-orange-500 font-semibold text-xs">View →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  style={{ minHeight: 'unset', minWidth: 'unset' }}
                  className="w-full text-left bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white font-extrabold text-lg flex-shrink-0">
                      {c.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.email || c.phone || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 bg-orange-50 text-orange-600 font-bold px-2 py-1 rounded-full">
                      <ShoppingBag size={10} /> {c.orderCount} orders
                    </span>
                    <span className="font-bold text-green-600">Rs. {c.totalSpent.toLocaleString()}</span>
                    <span className="text-gray-400 ml-auto">
                      {new Date(c.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-gray-500">Page {page} of {totalPages} ({total} customers)</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)} disabled={page === 1}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-orange-50 disabled:opacity-40 min-h-[40px] min-w-[40px] flex items-center justify-center"
                  ><ChevronLeft size={16} /></button>
                  <button
                    onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-orange-50 disabled:opacity-40 min-h-[40px] min-w-[40px] flex items-center justify-center"
                  ><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Customer Detail Modal */}
      {selectedId && (
        <CustomerModal
          customerId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
};

export default CustomersPage;
