import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Image } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';

// ── Category Form Modal ───────────────────────────────────────────────────────
const CategoryModal = ({ category, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: category?.name || '',
    sortOrder: category?.sortOrder !== undefined ? String(category.sortOrder) : '0',
  });
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(category?.imageUrl || null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: 'Name is required.' });
      return;
    }
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('sortOrder', form.sortOrder || '0');
      if (imageFile) fd.append('image', imageFile);

      if (category) {
        await api.patch(`/categories/${category.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Category updated!');
      } else {
        await api.post('/categories', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Category created!');
      }
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{category ? 'Edit Category' : 'Add Category'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Image */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Category Image</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-orange-400 transition-colors"
            >
              {preview ? (
                <div className="relative h-32">
                  <img src={preview} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-white text-sm font-medium">Change</p>
                  </div>
                </div>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <Image size={28} />
                  <p className="text-sm">Click to upload</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
          </div>

          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Name <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. BBQ, Fast Food, Drinks"
              className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px] ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">⚠ {errors.name}</p>}
          </div>

          {/* Sort order */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Display Order
              <span className="text-gray-400 font-normal ml-1">(lower = shown first)</span>
            </label>
            <input
              type="number" min="0" value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" isLoading={loading} className="flex-1">
              {category ? 'Save Changes' : 'Add Category'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Categories Page ──────────────────────────────────────────────────────
const AdminCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | category object

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.data.categories);
    } catch { /* keep */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleDelete = async (cat) => {
    if (!window.confirm(`Delete "${cat.name}"? All products in this category must be moved first.`)) return;
    try {
      await api.delete(`/categories/${cat.id}`);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      toast.success('Category deleted.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Categories ({categories.length})</h1>
        <Button variant="primary" size="sm" onClick={() => setModal('add')}>
          <Plus size={16} className="mr-1" /> Add Category
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No categories yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white rounded-2xl shadow-sm overflow-hidden group">
              {/* Image */}
              <div className="aspect-video bg-gradient-to-br from-orange-100 to-amber-50 relative overflow-hidden">
                {cat.imageUrl ? (
                  <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl">🍽️</div>
                )}
                {/* Action overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => setModal(cat)}
                    className="p-2.5 bg-white rounded-xl hover:bg-orange-50 text-orange-500 shadow min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="p-2.5 bg-white rounded-xl hover:bg-red-50 text-red-400 shadow min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{cat.name}</p>
                  <p className="text-xs text-gray-400">{cat._count?.products ?? 0} products · order {cat.sortOrder}</p>
                </div>
                <div className="flex gap-1 sm:hidden">
                  <button onClick={() => setModal(cat)} className="p-2 rounded-lg hover:bg-orange-50 text-orange-500 min-h-[36px] min-w-[36px] flex items-center justify-center">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(cat)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 min-h-[36px] min-w-[36px] flex items-center justify-center">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <CategoryModal
          category={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchCategories(); }}
        />
      )}
    </div>
  );
};

export default AdminCategoriesPage;
