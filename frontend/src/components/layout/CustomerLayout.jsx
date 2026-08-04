import { Outlet, Link } from 'react-router-dom';
import Navbar from './Navbar';
import useNewDealNotifier from '../../hooks/useNewDealNotifier';

const CustomerLayout = ({ onCartOpen }) => {
  // Polls every 60s — notifies with sound + toast + browser notification when new deal is featured
  useNewDealNotifier();

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col">
      <Navbar onCartOpen={onCartOpen} />

      {/* pb-20 = space for mobile bottom nav */}
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Desktop Footer */}
      <footer className="hidden md:block bg-gray-900 text-gray-400 text-sm">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white font-semibold text-lg">
            <span>🍽️</span> ZOCK Cafe
          </div>
          <p>© {new Date().getFullYear()} ZOCK Cafe. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/menu" className="hover:text-orange-400 transition-colors">Menu</Link>
            <Link to="/spin" className="hover:text-orange-400 transition-colors">Spin & Win</Link>
            <Link to="/orders" className="hover:text-orange-400 transition-colors">Track Order</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CustomerLayout;
