import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag, DollarSign, Clock, CheckCircle,
  TrendingUp, Package, ArrowRight, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import socket from '../../lib/socket';
import Spinner from '../../components/ui/Spinner';
import Badge, { orderStatusVariant, orderStatusLabel } from '../../components/ui/Badge';
import { StatusDropdown, OrderDetailModal } from './OrdersPage';

// ── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color = 'orange', loading }) => {
  const colors = {
    orange: 'bg-orange-50 text-orange-600',
    green:  'bg-green-50  text-green-600',
    blue:   'bg-blue-50   text-blue-600',
    amber:  'bg-amber-50  text-amber-600',
  };
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        {loading ? (
          <div className="h-7 w-20 bg-gray-100 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-extrabold text-gray-900 mt-0.5">{value}</p>
        )}
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const [stats,        setStats]        = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsRes, ordersRes] = await Promise.all([
        api.get('/admin/dashboard-stats'),
        api.get('/orders/admin?limit=8'),
      ]);
      setStats(statsRes.data.data);
      setRecentOrders(ordersRes.data.data.orders);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Real-time: new order arrives ─────────────────────────────────────────
  useEffect(() => {
    const handleNewOrder = (order) => {
      toast(`🔔 New Order #${order.id} — Rs. ${Number(order.totalAmount).toLocaleString()}`, {
        duration: 8000,
        id: `new-order-${order.id}`,
      });
      // Refresh stats + recent orders list
      fetchData();
    };

    const handleStatusUpdate = ({ id, status }) => {
      setRecentOrders((prev) =>
        prev.map((o) => o.id === id ? { ...o, status } : o)
      );
    };

    socket.on('new_order', handleNewOrder);
    socket.on('order_status_updated', handleStatusUpdate);
    return () => {
      socket.off('new_order', handleNewOrder);
      socket.off('order_status_updated', handleStatusUpdate);
    };
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-500 px-3 py-2 rounded-xl hover:bg-orange-50 transition-colors min-h-[44px]"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          icon={ShoppingBag}
          label="Today's Orders"
          value={stats?.todayOrders ?? '—'}
          sub="since midnight"
          color="orange"
          loading={loading}
        />
        <StatCard
          icon={DollarSign}
          label="Today's Revenue"
          value={stats ? `Rs. ${stats.todayRevenue.toLocaleString()}` : '—'}
          sub="excl. rejected"
          color="green"
          loading={loading}
        />
        <StatCard
          icon={Clock}
          label="Pending Orders"
          value={stats?.pendingOrders ?? '—'}
          sub="need attention"
          color="amber"
          loading={loading}
        />
        <StatCard
          icon={TrendingUp}
          label="Total Revenue"
          value={stats ? `Rs. ${stats.totalRevenue.toLocaleString()}` : '—'}
          sub="all time"
          color="blue"
          loading={loading}
        />
        <StatCard
          icon={CheckCircle}
          label="Customers"
          value={stats?.totalCustomers ?? '—'}
          sub="registered"
          color="green"
          loading={loading}
        />
      </div>

      {/* ── Quick Links ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { to: '/admin/orders?status=PENDING', label: 'Pending Orders', icon: Clock, color: 'text-amber-500 bg-amber-50' },
          { to: '/admin/products', label: 'Manage Products', icon: Package, color: 'text-blue-500 bg-blue-50' },
          { to: '/admin/orders', label: 'All Orders', icon: ShoppingBag, color: 'text-orange-500 bg-orange-50' },
        ].map(({ to, label, icon: Icon, color }) => (
          <Link
            key={to}
            to={to}
            className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-3 group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={18} />
            </div>
            <span className="text-sm font-semibold text-gray-700 group-hover:text-orange-600 transition-colors">{label}</span>
            <ArrowRight size={14} className="ml-auto text-gray-300 group-hover:text-orange-400 transition-colors" />
          </Link>
        ))}
      </div>

      {/* ── Recent Orders ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Recent Orders</h2>
          <Link to="/admin/orders" className="text-sm text-orange-500 hover:text-orange-600 font-semibold">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No orders yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Payment</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-orange-50/30 cursor-pointer transition-colors" onClick={() => setSelectedOrderId(order.id)}>
                    <td className="px-5 py-3.5 font-medium text-gray-900">#{order.id}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{order.user?.name}</p>
                      <p className="text-xs text-gray-400">{order.user?.phone || order.user?.email}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell font-semibold text-gray-900">
                      Rs. {Number(order.totalAmount).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell text-gray-500">
                      {order.paymentType === 'COD' ? 'Cash' : 'Online'}
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <StatusDropdown
                        currentStatus={order.status}
                        orderId={order.id}
                        onUpdated={(updated) => setRecentOrders((prev) => prev.map((o) => o.id === updated.id ? { ...o, status: updated.status } : o))}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-orange-500 font-semibold text-xs">View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onUpdated={(updated) => setRecentOrders((prev) => prev.map((o) => o.id === updated.id ? { ...o, status: updated.status } : o))}
        />
      )}
    </div>
  );
};

export default DashboardPage;
