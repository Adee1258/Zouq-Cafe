import { create } from 'zustand';
import api from '../lib/api';

const useDataStore = create((set, get) => ({
  categories: [],
  products: [],
  hasFetched: false,
  isLoading: false,
  error: null,

  fetchData: async (force = false) => {
    // If already fetched and not forcing a refresh, return early
    if (get().hasFetched && !force) return;

    set({ isLoading: true, error: null });
    try {
      const [catRes, prodRes] = await Promise.all([
        api.get('/categories'),
        api.get('/products?available=true'),
      ]);
      set({
        categories: catRes.data.data.categories,
        products: prodRes.data.data.products,
        hasFetched: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false, error: err.message });
    }
  },
}));

export default useDataStore;
