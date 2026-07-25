import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Package, Tag, ClipboardList, BarChart2,
  PieChart, Gift, LogOut, Menu, X, ChevronRight, Flame,
  Users, Bell,
} from 'lucide-react';
import useAdminAuthStore from '../../stores/adminAuthStore';
import useNewOrderNotifier from '../../hooks/useNewOrderNotifier';
import api from '../../lib/api';

const navItems = [
  { to: '/admin',            label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/orders',     label: 'Orders',    icon: ClipboardList },
  { to: '/admin/customers',  label: 'Customers', icon: Users },
  { to: '/admin/products',   label: 'Products',  icon: Package },
  { to: '/admin/categories', label: 'Categories',icon: Tag },
  { to: '/admin/deals',      label: 'Hot Deals', icon: Flame },
  { to: '/admin/reports',    label: 'Reports',   icon: BarChart2 },
  { to: '/admin/analytics',  label: 'Analytics', icon: PieChart },
  { to: '/admin/spin',       label: 'Spin & Win',icon: Gift },
];

const AdminLayout = () => {
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [pendingCount,  setPendingCount]  = useState(0);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const { user, logout } = useAdminAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();

  // Fetch pending count on mount and after new orders arrive
  const fetchPendingCount = async () => {
    try {
      const res = await api.get('/orders/admin?status=PENDING&limit=1&page=1');
      setPendingCount(res.data.data.total || 0);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchPendingCount(); }, [location.pathname]);

  // New order notifier — runs every 30s
  useNewOrderNotifier((newCount) => {
    setPendingCount((prev) => prev + newCount);
    setNewOrderFlash(true);
    setTimeout(() => setNewOrderFlash(false), 3000);
  });

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isActive = (item) =>
    item.exact
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to);

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Sidebar Overlay (mobile) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed top-0 left-0 z-40 h-full w-64 bg-gray-900 text-white flex flex-col
        transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-700">
          <Link to="/admin" className="flex items-center gap-2 font-bold text-lg text-orange-400">
            <span className="text-xl">🍽️</span> Zouq Admin
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-700 text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, exact }) => {
            const active = isActive({ to, exact });
            const isOrders = to === '/admin/orders';

            return (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
                <div className="ml-auto flex items-center gap-1.5">
                  {/* Pending orders badge */}
                  {isOrders && pendingCount > 0 && (
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none transition-all ${
                      newOrderFlash
                        ? 'bg-yellow-400 text-yellow-900 scale-110 animate-pulse'
                        : 'bg-red-500 text-white'
                    }`}>
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                  {active && <ChevronRight size={14} />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-4 border-t border-gray-700">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-900/30 transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 h-16 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-xl hover:bg-gray-100 text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>

          {/* Current page title */}
          <h1 className="text-base font-semibold text-gray-800">
            {navItems.find((i) => isActive(i))?.label || 'Admin'}
          </h1>

          <div className="ml-auto flex items-center gap-3">
            {/* Pending orders bell — top bar */}
            {pendingCount > 0 && (
              <Link
                to="/admin/orders?status=PENDING"
                className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  newOrderFlash
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                }`}
              >
                <Bell size={16} className={newOrderFlash ? 'animate-bounce' : ''} />
                <span className="hidden sm:inline">
                  {pendingCount} Pending
                </span>
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                  newOrderFlash ? 'bg-amber-500 text-white' : 'bg-orange-500 text-white'
                }`}>
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              </Link>
            )}

            <Link
              to="/"
              target="_blank"
              className="text-xs text-gray-500 hover:text-orange-500 transition-colors"
            >
              View Site ↗
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
