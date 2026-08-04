import { create } from 'zustand';
import api from '../lib/api';

const useDataStore = create((set, get) => ({
  categories: [],
  products: [],
  hasFetched: false,
  isLoading: false,
  error: null,

  fetchData: async (force = false) => {
    // Skip if already successfully fetched and not forcing a refresh
    // But if hasFetched is true with empty data, allow a retry
    const state = get();
    const hasData = state.products.length > 0 && state.categories.length > 0;
    if (state.hasFetched && hasData && !force) return;

    // Prevent concurrent fetches
    if (state.isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get('/categories'),
        api.get('/products?available=true'),
      ]);
      const categories = catRes.data.data.categories || [];
      const products   = prodRes.data.data.products   || [];
      set({
        categories,
        products,
        hasFetched: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      set({ isLoading: false, hasFetched: false, error: err.message });
    }
  },
}));

export default useDataStore;
