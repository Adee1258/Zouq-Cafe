import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, Trash2, ArrowRight, ShoppingBag, ArrowLeft, Flame } from 'lucide-react';
import useCartStore from '../../stores/cartStore';
import Button from '../../components/ui/Button';

const CartPage = () => {
  const items      = useCartStore((s) => s.items);
  const addItem    = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const deleteItem = useCartStore((s) => s.deleteItem);
  const clearCart  = useCartStore((s) => s.clearCart);
  const totalPrice = useCartStore((s) => s.totalPrice());
  const navigate   = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-7xl mb-4">🛒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-8">Looks like you haven't added anything yet.</p>
        <Link to="/menu" className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-8 py-4 rounded-xl transition-colors">
          <ShoppingBag size={18} /> Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-orange-500 text-sm font-medium transition-colors min-h-[44px]">
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">Cart</h1>
        <button onClick={clearCart} className="text-sm text-red-400 hover:text-red-600 font-medium min-h-[44px] flex items-center">
          Clear all
        </button>
      </div>

      {/* Items */}
      <div className="space-y-3 mb-6">
        {items.map((item) => (
          <div key={item.id} className={`flex items-center gap-3 rounded-2xl p-4 shadow-sm ${item.isDeal ? 'bg-orange-50 border border-orange-100' : 'bg-white'}`}>
            {/* Image */}
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-orange-50 flex-shrink-0">
              {item.imageUrl
                ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-2xl">{item.isDeal ? '🔥' : '🍽️'}</div>
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="font-semibold text-gray-900 text-sm line-clamp-1">{item.name}</p>
                {item.isDeal && (
                  <span className="flex items-center gap-0.5 text-[9px] font-extrabold bg-red-500 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">
                    <Flame size={8} /> DEAL
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Rs. {Number(item.price).toLocaleString()} {item.isDeal ? '(deal price)' : 'each'}
              </p>
              <p className="text-orange-600 font-bold text-sm">
                Rs. {(Number(item.price) * item.quantity).toLocaleString()}
              </p>
            </div>

            {/* Qty + delete */}
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => deleteItem(item.id)}
                className="text-red-400 hover:text-red-600 p-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
              >
                <Trash2 size={15} />
              </button>
              {/* Deals are always qty 1 — no stepper */}
              {!item.isDeal && (
                <div className="flex items-center gap-1 bg-gray-100 rounded-xl">
                  <button onClick={() => removeItem(item.id)} className="p-2 rounded-l-xl hover:bg-gray-200 min-h-[36px] min-w-[36px] flex items-center justify-center text-orange-500">
                    <Minus size={13} />
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                  <button onClick={() => addItem(item)} className="p-2 rounded-r-xl hover:bg-gray-200 min-h-[36px] min-w-[36px] flex items-center justify-center text-orange-500">
                    <Plus size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Order summary */}
      <div className="bg-white rounded-2xl p-5 shadow-sm mb-5">
        <h2 className="font-bold text-gray-900 mb-4">Order Summary</h2>
        <div className="space-y-2 text-sm">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-gray-600">
              <span className="truncate max-w-[60%]">
                {item.name} × {item.quantity}
                {item.isDeal && <span className="ml-1 text-orange-500 text-xs">(deal)</span>}
              </span>
              <span>Rs. {(Number(item.price) * item.quantity).toLocaleString()}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-3 flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-orange-600">Rs. {totalPrice.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <Button variant="primary" fullWidth size="lg" onClick={() => navigate('/checkout')} className="shadow-lg">
        Proceed to Checkout <ArrowRight size={18} className="ml-2" />
      </Button>
    </div>
  );
};

export default CartPage;
