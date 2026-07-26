import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Minus, ShoppingCart, ArrowLeft, Tag, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import useCartStore from '../../stores/cartStore';
import Spinner from '../../components/ui/Spinner';

const DealDetailPage = () => {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [deal, setDeal]       = useState(null);
  const [loading, setLoading] = useState(true);

  const addDeal    = useCartStore((s) => s.addDeal);
  const removeItem = useCartStore((s) => s.removeItem);
  const cartItems  = useCartStore((s) => s.items);

  const cartItem = cartItems.find((i) => i.isDeal && i.dealId === deal?.id);
  const qty      = cartItem?.quantity || 0;

  useEffect(() => {
    api.get(`/deals/${id}`)
      .then((r) => setDeal(r.data.data.deal))
      .catch(() => navigate('/deals', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleAdd = () => {
    addDeal(deal);
    if (qty === 0) toast.success(`${deal.title} added to cart! 🛒`);
  };

  const handleRemove = () => removeItem(`deal-${deal.id}`);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  );

  if (!deal) return null;

  const originalPrice = deal.items?.reduce(
    (s, it) => s + (it.productPrice || it.customPrice || 0) * it.quantity, 0
  ) || 0;
  const savings = originalPrice - deal.dealPrice;
  const pct     = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-orange-500 mb-4 text-sm font-medium transition-colors min-h-[44px]"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">

        {/* Image */}
        <div className="relative aspect-video bg-gradient-to-br from-orange-100 to-amber-50">
          {deal.imageUrl ? (
            <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl">🔥</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Discount badge */}
          {pct > 0 && (
            <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1 shadow">
              <Tag size={10} /> {pct}% OFF
            </span>
          )}

          {/* Title on image */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <span className="text-[10px] font-bold text-orange-300 uppercase tracking-widest flex items-center gap-1 mb-1">
              <Flame size={10} className="animate-pulse" /> Limited Offer
            </span>
            <h1 className="text-white font-extrabold text-2xl leading-tight drop-shadow-lg">
              {deal.title}
            </h1>
          </div>
        </div>

        {/* Details */}
        <div className="p-5 space-y-5">

          {/* Description */}
          {deal.description && (
            <p className="text-gray-500 text-sm leading-relaxed">{deal.description}</p>
          )}

          {/* Items included */}
          {deal.items?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                What's Included
              </p>
              <div className="space-y-2">
                {deal.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-orange-50 rounded-xl px-3 py-2.5">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white ring-1 ring-orange-100 flex-shrink-0">
                      {item.productImageUrl ? (
                        <img src={item.productImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {item.productName || item.customName}
                      </p>
                      {item.variantName && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                          {item.variantName}
                        </span>
                      )}
                    </div>
                    {item.quantity > 1 && (
                      <span className="text-xs font-bold text-orange-500 bg-white px-2 py-1 rounded-full flex-shrink-0 border border-orange-100">
                        ×{item.quantity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price */}
          <div className="flex items-end justify-between border-t border-gray-100 pt-4">
            <div>
              <p className="text-3xl font-extrabold text-orange-600">
                Rs. {Number(deal.dealPrice).toLocaleString()}
              </p>
              {originalPrice > deal.dealPrice && (
                <p className="text-sm text-gray-400 line-through mt-0.5">
                  Rs. {originalPrice.toLocaleString()}
                </p>
              )}
            </div>
            {savings > 0 && (
              <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                Save Rs. {savings.toLocaleString()}
              </span>
            )}
          </div>

          {/* Add to cart / qty stepper */}
          {qty === 0 ? (
            <button
              onClick={handleAdd}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-4 rounded-2xl text-base transition-all shadow-sm shadow-orange-200 min-h-[52px]"
            >
              <ShoppingCart size={18} /> Add to Cart
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-orange-50 rounded-2xl border border-orange-200 flex-1">
                <button
                  onClick={handleRemove}
                  style={{ minHeight: 'unset', minWidth: 'unset' }}
                  className="p-4 text-orange-500 hover:bg-orange-100 rounded-l-2xl transition-colors flex items-center justify-center"
                >
                  <Minus size={18} />
                </button>
                <span className="flex-1 text-center text-orange-600 font-extrabold text-xl">{qty}</span>
                <button
                  onClick={handleAdd}
                  style={{ minHeight: 'unset', minWidth: 'unset' }}
                  className="p-4 text-orange-500 hover:bg-orange-100 rounded-r-2xl transition-colors flex items-center justify-center"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          )}

          {qty > 0 && (
            <p className="text-center text-sm text-gray-400">
              {qty} deal{qty > 1 ? 's' : ''} in your cart · Rs. {(Number(deal.dealPrice) * qty).toLocaleString()} total
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DealDetailPage;
