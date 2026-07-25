import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart, Menu, X, User, LogOut, Gift, Home,
  UtensilsCrossed, ClipboardList, Flame,
} from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import useCartStore from '../../stores/cartStore';

const Navbar = ({ onCartOpen }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const cartItems = useCartStore((s) => s.items);
  const totalItems = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  const navLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/menu', label: 'Menu', icon: UtensilsCrossed },
    { to: '/deals', label: 'Hot Deals', icon: Flame },
    { to: '/spin', label: 'Spin & Win', icon: Gift },
    { to: '/orders', label: 'My Orders', icon: ClipboardList, auth: true },
  ];

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <>
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm shadow-sm border-b border-orange-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">

            {/* ── Logo ── */}
            <Link
              to="/"
              className="flex items-center gap-2 text-orange-500 font-bold text-xl"
              onClick={() => setMenuOpen(false)}
            >
              <span className="text-2xl">🍽️</span>
              <span className="hidden sm:inline">Zouq Cafe</span>
              <span className="sm:hidden">Zouq</span>
            </Link>

            {/* ── Desktop Nav Links ── */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label, auth }) => {
                if (auth && !user) return null;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(to)
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-600 hover:text-orange-500 hover:bg-orange-50'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            {/* ── Right Side Actions ── */}
            <div className="flex items-center gap-2">
              {/* Cart button — opens drawer on desktop, navigates on mobile */}
              <button
                onClick={() => onCartOpen ? onCartOpen() : null}
                className="relative p-2 rounded-xl text-gray-600 hover:text-orange-500 hover:bg-orange-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={`Cart, ${totalItems} items`}
              >
                <ShoppingCart size={22} />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {totalItems > 99 ? '99+' : totalItems}
                  </span>
                )}
              </button>

              {/* Auth: user menu or login */}
              {user ? (
                <div className="hidden md:flex items-center gap-2">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors min-h-[44px]"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 select-none">
                      {user.name?.[0]?.toUpperCase() || <User size={12} />}
                    </div>
                    <span className="max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Logout"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="hidden md:flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors min-h-[44px]"
                >
                  Login
                </Link>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Toggle menu"
              >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile Dropdown Menu ── */}
        {menuOpen && (
          <div className="md:hidden border-t border-orange-100 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(({ to, label, icon: Icon, auth }) => {
                if (auth && !user) return null;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive(to)
                        ? 'bg-orange-50 text-orange-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                );
              })}

              <div className="border-t border-gray-100 pt-2 mt-2">
                {user ? (
                  <>
                    <Link
                      to="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 select-none">
                        {user.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-400">View profile</p>
                      </div>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={18} />
                      Logout
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-center gap-2 bg-orange-500 text-white px-4 py-3 rounded-xl text-sm font-semibold"
                  >
                    Login / Sign Up
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-pb">
        <div className="flex items-center justify-around px-2 py-1">
          <Link
            to="/"
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px] ${
              isActive('/') ? 'text-orange-500' : 'text-gray-500'
            }`}
          >
            <Home size={20} />
            <span className="text-[10px] font-medium">Home</span>
          </Link>

          <Link
            to="/menu"
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px] ${
              isActive('/menu') ? 'text-orange-500' : 'text-gray-500'
            }`}
          >
            <UtensilsCrossed size={20} />
            <span className="text-[10px] font-medium">Menu</span>
          </Link>

          <button
            onClick={() => onCartOpen?.()}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px] relative ${
              isActive('/cart') ? 'text-orange-500' : 'text-gray-500'
            }`}
          >
            <ShoppingCart size={20} />
            {totalItems > 0 && (
              <span className="absolute top-1 right-2 bg-orange-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                {totalItems}
              </span>
            )}
            <span className="text-[10px] font-medium">Cart</span>
          </button>

          <Link
            to="/deals"
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px] ${
              isActive('/deals') ? 'text-orange-500' : 'text-gray-500'
            }`}
          >
            <Flame size={20} />
            <span className="text-[10px] font-medium">Deals</span>
          </Link>

          <Link
            to={user ? '/profile' : '/login'}
            className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px] ${
              (isActive('/profile') || isActive('/login')) ? 'text-orange-500' : 'text-gray-500'
            }`}
          >
            <User size={20} />
            <span className="text-[10px] font-medium">{user ? 'Me' : 'Login'}</span>
          </Link>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
