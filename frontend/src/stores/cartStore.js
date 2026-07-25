// Zustand cart store — persisted to localStorage
import { create } from 'zustand';

const CART_KEY = 'zouq_cart';

const loadCart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
  catch { return []; }
};

const saveCart = (items) => localStorage.setItem(CART_KEY, JSON.stringify(items));

const useCartStore = create((set, get) => ({
  items: loadCart(),

  // Add single product item or increment quantity
  addItem: (product) => {
    const items = get().items;
    const existing = items.find((i) => i.id === product.id && !i.isDeal);
    const updated = existing
      ? items.map((i) => i.id === product.id && !i.isDeal ? { ...i, quantity: i.quantity + 1 } : i)
      : [...items, { ...product, quantity: 1, isDeal: false }];
    saveCart(updated);
    set({ items: updated });
  },

  // Add a deal as a single bundle item at the deal price
  // dealId is used as the cart key — only one of each deal at a time
  addDeal: (deal) => {
    const items = get().items;
    // Remove any existing instance of this deal first
    const without = items.filter((i) => !(i.isDeal && i.dealId === deal.id));
    const dealItem = {
      id:       `deal-${deal.id}`,      // unique cart key
      dealId:   deal.id,
      isDeal:   true,
      name:     deal.title,
      price:    Number(deal.dealPrice), // ← actual deal price, not full price
      imageUrl: deal.imageUrl || null,
      quantity: 1,
      // Keep ALL items — both menu products and custom items
      dealItems: (deal.items || []).map((it) => ({
        productId:   it.productId || null,
        customName:  it.customName || null,
        customPrice: it.customPrice || 0,
        quantity:    it.quantity,
        type:        it.type || (it.productId ? 'menu' : 'custom'),
      })),
    };
    saveCart([...without, dealItem]);
    set({ items: [...without, dealItem] });
  },

  // Decrement or remove
  removeItem: (itemId) => {
    const items = get().items;
    const existing = items.find((i) => i.id === itemId);
    const updated = existing?.quantity > 1
      ? items.map((i) => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i)
      : items.filter((i) => i.id !== itemId);
    saveCart(updated);
    set({ items: updated });
  },

  // Remove all of an item
  deleteItem: (itemId) => {
    const updated = get().items.filter((i) => i.id !== itemId);
    saveCart(updated);
    set({ items: updated });
  },

  // Set specific quantity
  setQuantity: (itemId, quantity) => {
    if (quantity < 1) { get().deleteItem(itemId); return; }
    const updated = get().items.map((i) => i.id === itemId ? { ...i, quantity } : i);
    saveCart(updated);
    set({ items: updated });
  },

  // Clear cart
  clearCart: () => { saveCart([]); set({ items: [] }); },

  // Derived values
  totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
  totalPrice: () => get().items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0),
}));

export default useCartStore;
