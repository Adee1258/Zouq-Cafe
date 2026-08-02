import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, UtensilsCrossed } from 'lucide-react';
import useSEO from '../../hooks/useSEO';

const NotFoundPage = () => {
  useSEO({
    title:       'Page Not Found – Zouq Cafe Buch Villas Multan',
    description: 'This page does not exist. Head back to Zouq Cafe, the best restaurant in Buch Villas Multan, to order fresh food online.',
    canonical:   'https://zouqcafe.com/404',
  });

  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {/* Animated 404 */}
        <div className="relative mb-6 select-none">
          <p className="text-[120px] font-extrabold text-orange-100 leading-none select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl animate-bounce">🍽️</span>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
          Page Not Found
        </h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          Looks like this page went out for delivery and never came back.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:border-orange-300 hover:text-orange-500 transition-all"
          >
            <ArrowLeft size={16} /> Go Back
          </button>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors shadow-md shadow-orange-100"
          >
            <Home size={16} /> Home
          </Link>
          <Link
            to="/menu"
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm transition-colors"
          >
            <UtensilsCrossed size={16} /> Menu
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
