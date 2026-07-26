import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Minus, ShoppingCart, ArrowLeft, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import useCartStore from '../../stores/cartStore';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';

const ProductDetailPage = () => {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [product,  setProduct]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [qty,      setQty]      = useState(1);
  // selected variant — null means no variants / base product
  const [selectedVariant, setSelectedVariant] = useState(null);

  const items       = useCartStore((s) => s.items);
  const addItem     = useCartStore((s) => s.addItem);
  const setQuantity = useCartStore((s) => s.setQuantity);

  // cart key matches what cartStore uses
  const cartId   = selectedVariant ? `${product?.id}-v${selectedVariant.id}` : product?.id;
  const cartItem = items.find((i) => i.id === cartId);

  useEffect(() => {
    api.get(`/products/${id}`)
      .then((r) => {
        const p = r.data.data.product;
        setProduct(p);
        // Auto-select first variant if product has variants
        if (p.variants?.length > 0) setSelectedVariant(p.variants[0]);
        // If already in cart (no variant), start from current qty
        const existing = items.find((i) => i.id === p.id);
        if (existing) setQty(existing.quantity);
      })
      .catch(() => navigate('/menu', { replace: true }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  // Effective price — variant price if selected, else base price
  const effectivePrice = selectedVariant ? Number(selectedVariant.price) : Number(product?.price || 0);

  const handleAddToCart = () => {
    if (!product.isAvailable) return;
    // If product has variants, a size must be selected
    if (product.variants?.length > 0 && !selectedVariant) {
      toast.error('Please select a size first.');
      return;
    }

    const itemPayload = {
      id:          product.id,
      productId:   product.id,
      name:        selectedVariant ? `${product.name} — ${selectedVariant.name}` : product.name,
      price:       effectivePrice,
      imageUrl:    product.imageUrl,
      variantId:   selectedVariant?.id   || null,
      variantName: selectedVariant?.name || null,
    };

    if (cartItem) {
      setQuantity(cartId, qty);
    } else {
      for (let i = 0; i < qty; i++) addItem(itemPayload);
    }
    toast.success(`${itemPayload.name} added to cart!`);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  );
  if (!product) return null;

  const hasVariants = product.variants?.length > 0;

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
        <div className="aspect-video bg-orange-50 relative">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl">🍽️</div>
          )}
          {!product.isAvailable && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white text-gray-700 font-bold px-4 py-2 rounded-full">Currently Unavailable</span>
            </div>
          )}
        </div>

        <div className="p-5">
          {/* Category */}
          <Link
            to={`/menu?categoryId=${product.category?.id}`}
            className="inline-flex items-center gap-1 text-xs text-orange-500 font-semibold bg-orange-50 px-2.5 py-1 rounded-full mb-3 hover:bg-orange-100"
          >
            <Tag size={11} /> {product.category?.name}
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>

          {product.description && (
            <p className="text-gray-500 text-sm leading-relaxed mb-4">{product.description}</p>
          )}

          {/* ── Size selector chips ── */}
          {hasVariants && (
            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-700 mb-2">Select Size</p>
              <div className="flex gap-2 flex-wrap">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { setSelectedVariant(v); setQty(1); }}
                    style={{ minHeight: 'unset', minWidth: 'unset' }}
                    className={`flex flex-col items-center px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      selectedVariant?.id === v.id
                        ? 'border-orange-500 bg-orange-50 text-orange-600'
                        : 'border-gray-200 text-gray-600 hover:border-orange-300'
                    }`}
                  >
                    <span>{v.name}</span>
                    <span className={`text-xs font-bold mt-0.5 ${selectedVariant?.id === v.id ? 'text-orange-500' : 'text-gray-400'}`}>
                      Rs. {Number(v.price).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Price — dynamic based on selected variant */}
          <div className="text-3xl font-extrabold text-orange-500 mb-6">
            Rs. {effectivePrice.toLocaleString()}
            {hasVariants && selectedVariant && (
              <span className="ml-2 text-base font-semibold text-gray-400">({selectedVariant.name})</span>
            )}
          </div>

          {/* Qty + Add to cart */}
          {product.isAvailable ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="p-2.5 rounded-lg bg-white shadow-sm text-orange-500 hover:bg-orange-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Minus size={16} />
                </button>
                <span className="w-8 text-center font-bold text-lg">{qty}</span>
                <button
                  onClick={() => setQty(qty + 1)}
                  className="p-2.5 rounded-lg bg-white shadow-sm text-orange-500 hover:bg-orange-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Plus size={16} />
                </button>
              </div>

              <Button variant="primary" className="flex-1" onClick={handleAddToCart}>
                <ShoppingCart size={18} className="mr-2" />
                {cartItem ? 'Update Cart' : 'Add to Cart'}
                {qty > 1 && ` (${qty})`}
              </Button>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-xl px-4 py-3 text-center text-gray-500 text-sm font-medium">
              This item is currently unavailable
            </div>
          )}

          {cartItem && (
            <p className="text-center text-sm text-gray-400 mt-3">
              Currently {cartItem.quantity} in your cart
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
