import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Search, Star, SlidersHorizontal, X, Flame } from 'lucide-react';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import ProductCard from '../../components/ui/ProductCard';
import useDataStore from '../../stores/dataStore';
import useCartStore from '../../stores/cartStore';
import toast from 'react-hot-toast';

// ── One image per category (Unsplash CDN, free) ───────────────────────────────
const CATEGORY_IMAGES = {
  'BBQ':          'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80&fit=crop',
  'Fast Food':    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80&fit=crop',
  'Drinks':       'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=600&q=80&fit=crop',
  'Drink Corner': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&q=80&fit=crop',
};
const CATEGORY_EMOJI = { BBQ: '🥩', 'Fast Food': '🍔', Drinks: '🥤', 'Drink Corner': '🧃' };

const HomePage = () => {
  const { categories, isLoading: loading, fetchData } = useDataStore();
  const addItem = useCartStore((s) => s.addItem);
  const addDeal = useCartStore((s) => s.addDeal);

  const [deals,            setDeals]            = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [search,           setSearch]           = useState('');
  const [searchResults,    setSearchResults]    = useState([]);
  const [searching,        setSearching]        = useState(false);
  const [slide,            setSlide]            = useState(0);
  const [filterOpen,       setFilterOpen]       = useState(false);
  const [activeCategory,   setActiveCategory]   = useState(null);

  const navigate   = useNavigate();
  const inputRef   = useRef(null);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch active featured deals + featured products for homepage
  useEffect(() => {
    api.get('/deals?featured=true').then((r) => setDeals(r.data.data.deals)).catch(() => {});
    api.get('/products?featured=true&available=true')
      .then((r) => setFeaturedProducts(r.data.data.products))
      .catch(() => {});
  }, []);

  // Auto-slide — cycle through categories as hero slides
  useEffect(() => {
    if (!categories.length) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % categories.length), 4500);
    return () => clearInterval(t);
  }, [categories.length]);

  // Debounced search
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ search: search.trim(), available: 'true' });
        if (activeCategory) params.set('categoryId', activeCategory);
        const res = await api.get(`/products?${params}`);
        setSearchResults(res.data.data.products);
      } catch { setSearchResults([]); }
      finally  { setSearching(false); }
    }, 350);
    return () => clearTimeout(timer);
  }, [search, activeCategory]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!search.trim() && !activeCategory) return;
    const params = new URLSearchParams();
    if (search.trim())   params.set('search', search.trim());
    if (activeCategory)  params.set('categoryId', activeCategory);
    navigate(`/menu?${params}`);
    setSearch('');
    setFilterOpen(false);
  };

  const clearSearch = () => { setSearch(''); setSearchResults([]); };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  );

  // current hero slide based on categories
  const heroSlide = categories[slide % Math.max(categories.length, 1)];
  const selectedCat = categories.find((c) => c.id === activeCategory);

  return (
    <div className="max-w-7xl mx-auto">

      {/* ═══════════════════════════════════════════════════════
          HERO — real food photo per category, auto-slide
      ════════════════════════════════════════════════════════ */}
      <section className="mx-3 mt-3 sm:mx-4 sm:mt-4 rounded-3xl overflow-hidden relative h-56 sm:h-72 md:h-88 shadow-xl">

        {/* Slides */}
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === (slide % categories.length) ? 1 : 0 }}
          >
            <img
              src={CATEGORY_IMAGES[cat.name] || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80&fit=crop'}
              alt={cat.name}
              className="w-full h-full object-cover"
              loading={i === 0 ? 'eager' : 'lazy'}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          </div>
        ))}

        {/* Content — bottom aligned */}
        <div className="relative z-10 h-full flex flex-col justify-end p-4 sm:p-6">
          {heroSlide && (
            <div className="mb-3">
              <span className="inline-flex items-center gap-1.5 bg-orange-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full mb-2">
                {CATEGORY_EMOJI[heroSlide.name] || '🍽️'} {heroSlide.name}
              </span>
              <h1 className="text-xl sm:text-3xl font-extrabold text-white leading-snug drop-shadow">
                Fresh & Delicious<br />
                <span className="text-orange-400">Zouq Cafe</span>
              </h1>
            </div>
          )}

          {/* Buttons row */}
          <div className="flex items-center gap-2">
            <Link
              to="/menu"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm transition-colors flex items-center gap-1.5 shadow-lg"
            >
              Order Now <ChevronRight size={14} />
            </Link>
            <Link
              to="/spin"
              className="bg-white/15 backdrop-blur-sm hover:bg-white/25 text-white font-semibold px-4 py-2 rounded-xl text-xs sm:text-sm transition-colors flex items-center gap-1.5 border border-white/25"
            >
              🎡 Spin & Win
            </Link>

            {/* Slide dots — small, right-aligned */}
            <div className="flex gap-1 ml-auto">
              {categories.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  style={{ minHeight: 'unset', minWidth: 'unset' }}
                  className={`rounded-full transition-all duration-300 ${
                    i === (slide % categories.length)
                      ? 'w-4 h-1.5 bg-orange-400'
                      : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SEARCH BAR + FILTER BUTTON (one row)
      ════════════════════════════════════════════════════════ */}
      <section className="px-3 sm:px-4 mt-4 space-y-2">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          {/* Search input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="search"
              placeholder={activeCategory ? `Search in ${selectedCat?.name || ''}...` : 'Search food, drinks...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-3 rounded-xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm shadow-sm"
            />
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                style={{ minHeight: 'unset', minWidth: 'unset' }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter button */}
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={`flex items-center gap-1.5 px-3.5 py-3 rounded-xl text-sm font-semibold shadow-sm border transition-colors flex-shrink-0 ${
              activeCategory
                ? 'bg-orange-500 text-white border-orange-500'
                : filterOpen
                  ? 'bg-orange-50 text-orange-600 border-orange-300'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500'
            }`}
          >
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filter</span>
            {activeCategory && (
              <span className="bg-white/25 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                1
              </span>
            )}
          </button>

          {/* Search submit */}
          {(search.trim() || activeCategory) && (
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-3 rounded-xl text-sm transition-colors shadow-sm flex-shrink-0"
            >
              Go
            </button>
          )}
        </form>

        {/* Filter dropdown — category chips */}
        {filterOpen && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5 px-1">Filter by category</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setActiveCategory(null); setFilterOpen(false); }}
                style={{ minHeight: 'unset', minWidth: 'unset' }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                  !activeCategory
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500'
                }`}
              >
                🍽️ All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setActiveCategory(cat.id); setFilterOpen(false); }}
                  style={{ minHeight: 'unset', minWidth: 'unset' }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                    activeCategory === cat.id
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-500'
                  }`}
                >
                  {CATEGORY_EMOJI[cat.name] || '🍽️'} {cat.name}
                  {cat._count?.products > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                      activeCategory === cat.id ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-600'
                    }`}>
                      {cat._count.products}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search results dropdown */}
        {search && searchResults.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {searchResults.slice(0, 5).map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                onClick={clearSearch}
                className="flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-orange-100 flex-shrink-0">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-base">🍽️</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-orange-500 font-semibold">Rs. {Number(p.price).toLocaleString()}</p>
                </div>
                <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />
              </Link>
            ))}
            {searchResults.length > 5 && (
              <Link
                to={`/menu?search=${encodeURIComponent(search)}`}
                onClick={clearSearch}
                className="block px-4 py-2.5 text-center text-xs text-orange-500 font-semibold hover:bg-orange-50"
              >
                See all {searchResults.length} results →
              </Link>
            )}
          </div>
        )}
        {search && !searching && searchResults.length === 0 && (
          <div className="bg-white rounded-2xl shadow border border-gray-100 px-4 py-4 text-center text-sm text-gray-400">
            No results for &ldquo;{search}&rdquo;
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════
          HOT DEALS SECTION
      ════════════════════════════════════════════════════════ */}
      {deals.length > 0 && (
        <section className="px-3 sm:px-4 mt-6">
          {/* Animated heading */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="text-base font-extrabold text-gray-900 flex items-center gap-1.5">
                  <Flame size={17} className="text-red-500 animate-pulse" />
                  <span className="relative overflow-hidden">
                    Hot Deals
                    <span className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(105deg, transparent 40%, rgba(255,160,50,0.35) 50%, transparent 60%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer-slide 2.5s ease-in-out infinite',
                      }}
                    />
                  </span>
                </span>
              </div>
            </div>
            <Link to="/deals" className="text-xs text-orange-500 font-semibold flex items-center gap-0.5 hover:text-orange-600">
              See all <ChevronRight size={13} />
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
            {deals.map((deal) => {
              const originalPrice = deal.items?.reduce((s, it) => s + (it.productPrice || it.customPrice || 0) * it.quantity, 0) || 0;
              const pct = originalPrice > 0 ? Math.round((1 - deal.dealPrice / originalPrice) * 100) : 0;

              const addDealToCart = () => {
                addDeal(deal);
                toast.success(`${deal.title} added! 🛒`);
              };

              return (
                <div key={deal.id} className="flex-shrink-0 w-64 bg-white rounded-2xl shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300">
                  <div className="relative h-32 bg-gradient-to-br from-orange-100 to-amber-50 overflow-hidden">
                    {deal.imageUrl
                      ? <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : <div className="w-full h-full flex items-center justify-center text-3xl">🔥</div>
                    }
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                    {/* shimmer sweep on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                      style={{ background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.18) 50%, transparent 65%)' }} />
                    {pct > 0 && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
                        -{pct}%
                      </span>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-3 pb-2">
                      <p className="text-[9px] font-bold text-orange-300 uppercase tracking-widest mb-0.5">🔥 Limited Offer</p>
                      <p className="text-white font-extrabold text-sm leading-tight drop-shadow-md tracking-tight">
                        {deal.title}
                      </p>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {deal.items?.slice(0, 3).map((item, i) => (
                        <span key={i} className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full font-medium truncate max-w-[90px]">
                          {item.productName || item.customName}
                        </span>
                      ))}
                      {deal.items?.length > 3 && (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">+{deal.items.length - 3} more</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-extrabold text-orange-600">Rs. {Number(deal.dealPrice).toLocaleString()}</p>
                        {originalPrice > deal.dealPrice && (
                          <p className="text-[10px] text-gray-400 line-through">Rs. {originalPrice.toLocaleString()}</p>
                        )}
                      </div>
                      <button
                        onClick={addDealToCart}
                        style={{ minHeight: 'unset', minWidth: 'unset' }}
                        className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════
          POPULAR ITEMS — admin-featured products only
      ════════════════════════════════════════════════════════ */}
      {featuredProducts.length > 0 ? (
        <section className="px-3 sm:px-4 mt-6 pb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-base font-extrabold text-gray-900 flex items-center gap-1.5">
              <Star size={15} className="text-amber-400 fill-amber-400" />
              <span className="relative overflow-hidden">
                Popular Items
                <span className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(105deg, transparent 40%, rgba(251,191,36,0.3) 50%, transparent 60%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer-slide 3s ease-in-out infinite',
                    animationDelay: '1s',
                  }}
                />
              </span>
            </span>
            <Link to="/menu" className="text-xs text-orange-500 font-semibold flex items-center gap-0.5 hover:text-orange-600">
              See all <ChevronRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : (
        /* No featured products yet — show a soft CTA to browse the menu */
        <section className="px-3 sm:px-4 mt-6 pb-8 text-center">
          <div className="bg-orange-50 rounded-2xl py-10 px-6">
            <p className="text-3xl mb-2">🍽️</p>
            <p className="font-bold text-gray-800 mb-1">Explore Our Menu</p>
            <p className="text-sm text-gray-500 mb-4">Freshly prepared just for you</p>
            <Link
              to="/menu"
              className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors"
            >
              View Full Menu <ChevronRight size={14} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;