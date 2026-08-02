import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import ProductCard from '../../components/ui/ProductCard';
import Spinner from '../../components/ui/Spinner';
import useDataStore from '../../stores/dataStore';
import useSEO from '../../hooks/useSEO';

const MenuPage = () => {
  useSEO({
    title:       'Menu – Zouq Cafe Buch Villas Multan | BBQ Tikka, Seekh Kabab, Burgers & More',
    description: 'Full menu at Zouq Cafe Buch Villas Multan — chicken tikka, beef tikka, seekh kabab, BBQ platter, chapli kabab, boti kabab, burgers, shawarma & drinks. Order online!',
    keywords:    'Zouq Cafe menu, BBQ menu Multan, tikka menu Buch Villas, seekh kabab Multan, BBQ platter Multan, chicken tikka Multan, chapli kabab Multan, burger menu Multan',
    canonical:   'https://zouqcafe.com/menu',
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, products: allProducts, isLoading: loading, fetchData } = useDataStore();
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const activeCategoryId = searchParams.get('categoryId')
    ? Number(searchParams.get('categoryId'))
    : null;

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Instant local filtering
  const products = allProducts.filter(p => {
    if (activeCategoryId && p.categoryId !== activeCategoryId) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectCategory = (id) => {
    const p = new URLSearchParams(searchParams);
    if (id === null) p.delete('categoryId');
    else p.set('categoryId', id);
    setSearchParams(p);
  };

  const clearSearch = () => {
    setSearch('');
    const p = new URLSearchParams(searchParams);
    p.delete('search');
    setSearchParams(p);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-5">

      {/* ── Search ── */}
      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Search menu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm min-h-[48px]"
        />
        {search && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Category Filter Tabs (horizontal scroll on mobile) ── */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 no-scrollbar">
        <button
          onClick={() => selectCategory(null)}
          className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[40px] ${
            !activeCategoryId
              ? 'bg-orange-500 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-orange-50 border border-gray-200'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => selectCategory(cat.id)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[40px] ${
              activeCategoryId === cat.id
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-orange-50 border border-gray-200'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* ── Results Header ── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {loading ? 'Loading...' : `${products.length} item${products.length !== 1 ? 's' : ''}`}
          {activeCategoryId && categories.find(c => c.id === activeCategoryId)
            ? ` in ${categories.find(c => c.id === activeCategoryId).name}`
            : ''}
        </p>
        {(activeCategoryId || search) && (
          <button
            onClick={() => { selectCategory(null); clearSearch(); }}
            className="text-xs text-orange-500 font-semibold flex items-center gap-1 hover:text-orange-600"
          >
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {/* ── Product Grid ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-gray-500 font-medium">No items found</p>
          <p className="text-gray-400 text-sm mt-1">Try a different category or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MenuPage;
