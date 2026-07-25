// Slide-in cart drawer — works on all screen sizes
// On mobile: full-screen bottom sheet; on desktop: right-side panel
import { X, ShoppingCart, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useCartStore from '../../stores/cartStore';

const CartDrawer = ({ open, onClose }) => {
  const items = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const deleteItem = useCartStore((s) => s.deleteItem);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const totalPrice = useCartStore((s) => s.totalPrice());
  const navigate = useNavigate();

  const handleCheckout = () => {
    onClose();
    navigate('/checkout');
  };

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        className={`
          fixed z-50 bg-white flex flex-col
          transition-transform duration-300 ease-in-out
          /* Mobile: bottom sheet */
          bottom-0 left-0 right-0 rounded-t-2xl max-h-[85dvh]
          /* Desktop: right sidebar */
          sm:top-0 sm:right-0 sm:left-auto sm:bottom-auto sm:h-full sm:w-96 sm:rounded-none sm:rounded-l-2xl
          ${open
            ? 'translate-y-0 sm:translate-x-0'
            : 'translate-y-full sm:translate-y-0 sm:translate-x-full'
          }
        `}
        role="dialog"
        aria-label="Shopping cart"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-orange-500" />
            <h2 className="font-bold text-gray-900 text-lg">Your Cart</h2>
            {items.length > 0 && (
              <span className="bg-orange-100 text-orange-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                {items.reduce((s, i) => s + i.quantity, 0)} items
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close cart"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center">
              <div className="text-6xl">🛒</div>
              <p className="text-gray-500 font-medium">Your cart is empty</p>
              <p className="text-gray-400 text-sm">Browse our menu and add something delicious!</p>
              <button
                onClick={() => { onClose(); navigate('/menu'); }}
                className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-orange-600 transition-colors"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className={`flex items-center gap-3 rounded-xl p-3 ${item.isDeal ? 'bg-orange-50 border border-orange-100' : 'bg-gray-50'}`}>
                {/* Image */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-orange-100 flex-shrink-0">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">
                      {item.isDeal ? '🔥' : '🍽️'}
                    </div>
                  )}
                </div>

                {/* Name + price */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-medium text-gray-900 text-sm line-clamp-1">{item.name}</p>
                    {item.isDeal && (
                      <span className="text-[9px] font-extrabold bg-red-500 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">DEAL</span>
                    )}
                  </div>
                  <p className="text-orange-600 text-sm font-semibold">
                    Rs. {(Number(item.price) * item.quantity).toLocaleString()}
                  </p>
                  <p className="text-gray-400 text-xs">Rs. {Number(item.price).toLocaleString()} each</p>
                </div>

                {/* Quantity control */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 rounded-lg bg-white border border-gray-200 text-orange-500 hover:bg-orange-50 min-h-[32px] min-w-[32px] flex items-center justify-center"
                    aria-label="Remove one"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-6 text-center font-bold text-sm">{item.quantity}</span>
                  <button
                    onClick={() => item.isDeal
                      ? setQuantity(item.id, item.quantity + 1)
                      : addItem(item)
                    }
                    className="p-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 min-h-[32px] min-w-[32px] flex items-center justify-center"
                    aria-label="Add one more"
                  >
                    <Plus size={12} />
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 min-h-[32px] min-w-[32px] flex items-center justify-center ml-1"
                    aria-label="Remove item"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer — total + checkout */}
        {items.length > 0 && (
          <div className="px-4 py-4 border-t border-gray-100 space-y-3 bg-white">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Total</span>
              <span className="text-xl font-bold text-gray-900">
                Rs. {totalPrice.toLocaleString()}
              </span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl transition-colors text-base active:scale-95 min-h-[52px]"
            >
              Proceed to Checkout <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;
