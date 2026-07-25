// ProductCard — used in category grid and search results
import { Plus, Minus, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import useCartStore from '../../stores/cartStore';
import useFavoritesStore from '../../stores/favoritesStore';

const ProductCard = ({ product }) => {
  const items     = useCartStore((s) => s.items);
  const addItem   = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);

  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const isFavorite     = useFavoritesStore((s) => s.isFavorite);
  const fav = isFavorite(product.id, 'product');

  const cartItem = items.find((i) => i.id === product.id);
  const qty = cartItem?.quantity || 0;

  const handleAdd = (e) => {
    e.preventDefault();
    addItem({ id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl });
  };

  const handleRemove = (e) => {
    e.preventDefault();
    removeItem(product.id);
  };

  const handleFav = (e) => {
    e.preventDefault();
    toggleFavorite({
      id: product.id, type: 'product',
      name: product.name, price: Number(product.price),
      imageUrl: product.imageUrl,
    });
  };

  return (
    <Link
      to={`/product/${product.id}`}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col"
    >
      {/* Image */}
      <div className="relative bg-orange-50 overflow-hidden aspect-square">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
        )}
        {!product.isAvailable && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-white text-gray-700 text-xs font-semibold px-3 py-1 rounded-full">
              Unavailable
            </span>
          </div>
        )}
        {/* Favorite button */}
        <button
          onClick={handleFav}
          style={{ minHeight: 'unset', minWidth: 'unset' }}
          className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md backdrop-blur-sm transition-all duration-200 active:scale-90 ${
            fav ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-400 hover:text-red-500'
          }`}
          aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart size={13} className={fav ? 'fill-white' : ''} />
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-auto">
          <span className="font-bold text-orange-600 text-base">
            Rs. {Number(product.price).toLocaleString()}
          </span>

          {product.isAvailable && (
            qty === 0 ? (
              <button
                onClick={handleAdd}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors min-h-[36px] active:scale-95"
                aria-label={`Add ${product.name} to cart`}
              >
                <Plus size={14} /> Add
              </button>
            ) : (
              <div className="flex items-center gap-1 bg-orange-50 rounded-xl border border-orange-200">
                <button onClick={handleRemove} className="p-2 text-orange-500 hover:bg-orange-100 rounded-l-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center" aria-label="Remove one">
                  <Minus size={14} />
                </button>
                <span className="text-orange-600 font-bold text-sm w-5 text-center">{qty}</span>
                <button onClick={handleAdd} className="p-2 text-orange-500 hover:bg-orange-100 rounded-r-xl transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center" aria-label="Add one more">
                  <Plus size={14} />
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
