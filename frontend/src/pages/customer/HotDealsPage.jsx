import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Flame, Tag, Search, X, Heart, Plus, Minus } from 'lucide-react';import toast from 'react-hot-toast';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import useCartStore from '../../stores/cartStore';
import useFavoritesStore from '../../stores/favoritesStore';
import useSEO from '../../hooks/useSEO';

// ── Deal Card ─────────────────────────────────────────────────────────────────
const DealCard = ({ deal }) => {
  const addDeal        = useCartStore((s) => s.addDeal);
  const removeItem     = useCartStore((s) => s.removeItem);
  const cartItems      = useCartStore((s) => s.items);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const isFavorite     = useFavoritesStore((s) => s.isFavorite);
  const fav = isFavorite(deal.id, 'deal');

  // find this deal in cart — id is always `deal-${deal.id}`
  const cartItem = cartItems.find((i) => i.isDeal && i.dealId === deal.id);
  const qty = cartItem?.quantity || 0;

  const originalPrice = deal.items?.reduce((s, it) => s + (it.productPrice || it.customPrice || 0) * it.quantity, 0) || 0;
  const savings = originalPrice - deal.dealPrice;
  const pct = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

  const handleAdd = () => {
    addDeal(deal);
    if (qty === 0) toast.success(`${deal.title} added to cart! 🛒`);
  };

  const handleRemove = () => {
    removeItem(`deal-${deal.id}`);
  };

  const handleFav = () => {
    toggleFavorite({ id: deal.id, type: 'deal', name: deal.title, dealPrice: deal.dealPrice, imageUrl: deal.imageUrl });
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group">
      {/* Image — clickable → detail page */}
      <Link to={`/deals/${deal.id}`} className="relative h-48 sm:h-56 overflow-hidden bg-gradient-to-br from-orange-100 to-amber-50 flex-shrink-0 block">
        {deal.imageUrl ? (
          <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🔥</div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        {/* Shimmer light sweep on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
          style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)', backgroundSize: '200% 100%', animation: 'shimmer 1.2s ease forwards' }} />

        {/* Discount badge */}
        {pct > 0 && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg">
            <Tag size={9} /> {pct}% OFF
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={(e) => { e.preventDefault(); handleFav(); }}
          style={{ minHeight: 'unset', minWidth: 'unset' }}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm transition-all duration-200 active:scale-90 ${
            fav ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-400 hover:text-red-500'
          }`}
        >
          <Heart size={14} className={fav ? 'fill-white' : ''} />
        </button>

        {/* Title over image — enhanced */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-orange-300 uppercase tracking-widest">🔥 Limited Offer</span>
          </div>
          <h3 className="text-white font-extrabold text-lg sm:text-xl leading-tight drop-shadow-lg tracking-tight">
            {deal.title}
          </h3>
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        {deal.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2 italic">{deal.description}</p>
        )}

        {/* Items included */}
        {deal.items?.length > 0 && (
          <div className="mb-4 space-y-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Includes</p>
            {deal.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-orange-50 flex-shrink-0 ring-1 ring-orange-100">
                  {item.productImageUrl
                    ? <img src={item.productImageUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xs">🍽️</div>
                  }
                </div>
                <span className="text-sm text-gray-700 flex-1 truncate font-medium">{item.productName || item.customName}</span>
                {item.quantity > 1 && (
                  <span className="text-xs font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full flex-shrink-0">×{item.quantity}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Price row */}
        <div className="flex items-end justify-between mt-auto mb-3">
          <div>
            <p className="text-2xl font-extrabold text-orange-600">
              Rs. {Number(deal.dealPrice).toLocaleString()}
            </p>
            {originalPrice > deal.dealPrice && (
              <p className="text-xs text-gray-400 line-through">Rs. {originalPrice.toLocaleString()}</p>
            )}
          </div>
          {savings > 0 && (
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
              Save Rs. {savings.toLocaleString()}
            </span>
          )}
        </div>

        {/* Add to cart / qty stepper */}
        {qty === 0 ? (
          <button
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-3 rounded-2xl text-sm transition-all shadow-sm shadow-orange-200"
          >
            <ShoppingCart size={16} /> Add to Cart
          </button>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-orange-50 rounded-2xl border border-orange-200 flex-1">
              <button
                onClick={handleRemove}
                style={{ minHeight: 'unset', minWidth: 'unset' }}
                className="p-3 text-orange-500 hover:bg-orange-100 rounded-l-2xl transition-colors flex items-center justify-center"
                aria-label="Remove one"
              >
                <Minus size={15} />
              </button>
              <span className="flex-1 text-center text-orange-600 font-extrabold text-base">{qty}</span>
              <button
                onClick={handleAdd}
                style={{ minHeight: 'unset', minWidth: 'unset' }}
                className="p-3 text-orange-500 hover:bg-orange-100 rounded-r-2xl transition-colors flex items-center justify-center"
                aria-label="Add one more"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const HotDealsPage = () => {
  useSEO({
    title:       'Hot Deals – ZOCK Cafe Buch Villas Multan | BBQ Combos, Tikka Bundles & Offers',
    description: 'Best BBQ deals in Buch Villas Multan! Tikka combo, seekh kabab bundle, BBQ family platter at unbeatable prices. Order online from ZOCK Cafe now!',
    keywords:    'BBQ deals Multan, tikka combo Buch Villas, seekh kabab bundle Multan, BBQ bundle Multan, food deals Buch Villas, hot deals Multan restaurant',
    canonical:   'https://zouqcafe.com/deals',
  });

  const [deals,   setDeals]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    api.get('/deals')
      .then((r) => setDeals(r.data.data.deals))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = deals.filter((d) =>
    !search.trim() ||
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.description?.toLowerCase().includes(search.toLowerCase()) ||
    d.items?.some((it) => (it.productName || it.customName || '').toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white shadow-lg shadow-orange-200">
          <Flame size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Hot Deals</h1>
          <p className="text-sm text-gray-400">Limited time bundles — best value!</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          placeholder="Search deals..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-3 rounded-2xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm shadow-sm"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ minHeight: 'unset', minWidth: 'unset' }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {deals.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🔥</div>
          <p className="text-lg font-semibold text-gray-700">No deals available right now</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">Check back soon for amazing bundles!</p>
          <Link to="/menu" className="inline-flex items-center gap-2 bg-orange-500 text-white font-bold px-6 py-3 rounded-xl hover:bg-orange-600 transition-colors">
            Browse Menu
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">No deals match &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HotDealsPage;
