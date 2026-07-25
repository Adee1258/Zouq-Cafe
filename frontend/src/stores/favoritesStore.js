// Favorites store — persisted in localStorage
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useFavoritesStore = create(
  persist(
    (set, get) => ({
      favorites: [], // [{ id, name, price, imageUrl, type: 'product'|'deal', dealPrice? }]

      toggleFavorite: (item) => {
        const exists = get().favorites.find((f) => f.id === item.id && f.type === item.type);
        if (exists) {
          set((s) => ({ favorites: s.favorites.filter((f) => !(f.id === item.id && f.type === item.type)) }));
        } else {
          set((s) => ({ favorites: [...s.favorites, item] }));
        }
      },

      isFavorite: (id, type) =>
        get().favorites.some((f) => f.id === id && f.type === type),

      clearFavorites: () => set({ favorites: [] }),
    }),
    { name: 'zouq_favorites' }
  )
);

export default useFavoritesStore;
