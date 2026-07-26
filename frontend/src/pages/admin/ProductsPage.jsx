import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search, X, Upload, Image, Star, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

// ── Product Form Modal ────────────────────────────────────────────────────────
const ProductModal = ({ product, categories, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: product?.name || '',
    description: product?.description || '',
    price: product?.price ? String(product.price) : '',
    categoryId: product?.categoryId ? String(product.categoryId) : '',
    isAvailable: product?.isAvailable ?? true,
  });
  // variants: array of {id?(existing), name, price, isAvailable}
  const [variants, setVariants] = useState(
    product?.variants?.length
      ? product.variants.map((v) => ({ id: v.id, name: v.name, price: String(v.price), isAvailable: v.isAvailable }))
      : []
  );
  const hasVariants = variants.length > 0;
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(product?.imageUrl || null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  // Variant helpers
  const addVariant = () => setVariants((v) => [...v, { name: '', price: '', isAvailable: true }]);
  const removeVariant = (i) => setVariants((v) => v.filter((_, idx) => idx !== i));
  const setVariantField = (i, field, val) =>
    setVariants((v) => v.map((vt, idx) => idx === i ? { ...vt, [field]: val } : vt));

  const SIZES = ['Small', 'Medium', 'Large'];
  const quickAddSize = (name) => {
    if (!variants.find((v) => v.name === name))
      setVariants((v) => [...v, { name, price: '', isAvailable: true }]);
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.categoryId) e.categoryId = 'Category is required.';
    // Price required only when no variants
    if (!hasVariants && (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0))
      e.price = 'Valid price is required.';
    // Each variant must have name + valid price
    variants.forEach((v, i) => {
      if (!v.name.trim()) e[`v_name_${i}`] = 'Size name required.';
      if (!v.price || isNaN(Number(v.price)) || Number(v.price) < 0) e[`v_price_${i}`] = 'Price required.';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('description', form.description.trim());
      // Use 0 as base price when variants exist (variants carry real prices)
      fd.append('price', hasVariants ? '0' : form.price);
      fd.append('categoryId', form.categoryId);
      fd.append('isAvailable', String(form.isAvailable));
      if (imageFile) fd.append('image', imageFile);

      let savedProduct;
      if (product) {
        const res = await api.patch(`/products/${product.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        savedProduct = res.data.data.product;
        toast.success('Product updated!');
      } else {
        const res = await api.post('/products', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        savedProduct = res.data.data.product;
        toast.success('Product created!');
      }

      // Save variants via PUT /products/:id/variants (replaces all)
      await api.put(`/products/${savedProduct.id}/variants`, {
        variants: variants.map((v, i) => ({
          name:        v.name.trim(),
          price:       Number(v.price),
          isAvailable: v.isAvailable,
          sortOrder:   i,
        })),
      });

      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-4">

            {/* Image upload */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Product Image</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-orange-400 transition-colors"
              >
                {preview ? (
                  <div className="relative aspect-video">
                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <p className="text-white text-sm font-medium flex items-center gap-1"><Upload size={14} /> Change</p>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video flex flex-col items-center justify-center gap-2 text-gray-400">
                    <Image size={32} />
                    <p className="text-sm">Click to upload image</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </div>

            {/* Name */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Name <span className="text-red-500">*</span></label>
              <input
                value={form.name} onChange={set('name')} placeholder="e.g. Chicken Karahi (1kg)"
                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px] ${errors.name ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">⚠ {errors.name}</p>}
            </div>

            {/* Category + Price row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Category <span className="text-red-500">*</span></label>
                <select
                  value={form.categoryId} onChange={set('categoryId')}
                  className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px] bg-white ${errors.categoryId ? 'border-red-400' : 'border-gray-200'}`}
                >
                  <option value="">Select...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.categoryId && <p className="text-xs text-red-500 mt-1">⚠ {errors.categoryId}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Price (Rs.) {!hasVariants && <span className="text-red-500">*</span>}
                  {hasVariants && <span className="text-xs text-gray-400 font-normal ml-1">— set per size</span>}
                </label>
                {hasVariants ? (
                  <div className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-400 min-h-[44px] flex items-center">
                    Varies by size
                  </div>
                ) : (
                  <>
                    <input
                      type="number" min="0" step="1" value={form.price} onChange={set('price')} placeholder="350"
                      className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px] ${errors.price ? 'border-red-400' : 'border-gray-200'}`}
                    />
                    {errors.price && <p className="text-xs text-red-500 mt-1">⚠ {errors.price}</p>}
                  </>
                )}
              </div>
            </div>

            {/* ── Variants / Sizes ── */}
            <div className="border border-gray-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Sizes / Variants</p>
                  <p className="text-xs text-gray-400">Add Small, Medium, Large with separate prices</p>
                </div>
                <button
                  type="button" onClick={addVariant}
                  style={{ minHeight: 'unset', minWidth: 'unset' }}
                  className="flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white font-semibold px-2.5 py-1.5 rounded-lg"
                >
                  <Plus size={12} /> Add Size
                </button>
              </div>

              {/* Quick-add chips */}
              {variants.length === 0 && (
                <div className="flex gap-2">
                  {SIZES.map((s) => (
                    <button
                      key={s} type="button" onClick={() => quickAddSize(s)}
                      style={{ minHeight: 'unset', minWidth: 'unset' }}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold border border-orange-200 text-orange-500 hover:bg-orange-50 transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              )}

              {variants.length > 0 && (
                <div className="space-y-2">
                  {variants.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                      {/* Size name */}
                      <input
                        value={v.name}
                        onChange={(e) => setVariantField(i, 'name', e.target.value)}
                        placeholder="e.g. Small"
                        style={{ minHeight: 'unset' }}
                        className={`w-28 rounded-lg border px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${errors[`v_name_${i}`] ? 'border-red-400' : 'border-gray-200'} bg-white`}
                      />
                      {/* Price */}
                      <div className="flex items-center flex-1 gap-1.5">
                        <span className="text-xs text-gray-400 font-medium">Rs.</span>
                        <input
                          type="number" min="0" step="1"
                          value={v.price}
                          onChange={(e) => setVariantField(i, 'price', e.target.value)}
                          placeholder="0"
                          style={{ minHeight: 'unset' }}
                          className={`flex-1 rounded-lg border px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${errors[`v_price_${i}`] ? 'border-red-400' : 'border-gray-200'} bg-white`}
                        />
                      </div>
                      {/* Available toggle */}
                      <button
                        type="button"
                        onClick={() => setVariantField(i, 'isAvailable', !v.isAvailable)}
                        style={{ minHeight: 'unset', minWidth: 'unset' }}
                        title={v.isAvailable ? 'Available' : 'Unavailable'}
                        className={`w-8 h-4 rounded-full transition-colors flex-shrink-0 relative ${v.isAvailable ? 'bg-orange-500' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${v.isAvailable ? 'left-4' : 'left-0.5'}`} />
                      </button>
                      {/* Remove */}
                      <button
                        type="button" onClick={() => removeVariant(i)}
                        style={{ minHeight: 'unset', minWidth: 'unset' }}
                        className="p-1 rounded-lg hover:bg-red-50 text-red-400"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Description</label>
              <textarea
                value={form.description} onChange={set('description')} rows={3}
                placeholder="Briefly describe this item..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>

            {/* Availability toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Available for ordering</p>
                <p className="text-xs text-gray-400">Toggle off to hide from menu</p>
              </div>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, isAvailable: !p.isAvailable }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${form.isAvailable ? 'bg-orange-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isAvailable ? 'left-6' : 'left-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-3">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" isLoading={loading} className="flex-1">
              {product ? 'Save Changes' : 'Add Product'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Products Page ────────────────────────────────────────────────────────
const AdminProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | product object

  const fetchProducts = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        api.get('/products'),
        api.get('/categories'),
      ]);
      setProducts(pRes.data.data.products);
      setCategories(cRes.data.data.categories);
    } catch { /* keep previous */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, []);

  const handleToggle = async (product) => {
    try {
      await api.patch(`/products/${product.id}/toggle`);
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p)
      );
      toast.success(`${product.name} ${product.isAvailable ? 'disabled' : 'enabled'}`);
    } catch (err) { toast.error(err.message); }
  };

  const handleFeature = async (product) => {
    try {
      const res = await api.patch(`/products/${product.id}/feature`);
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? res.data.data.product : p)
      );
      toast.success(
        res.data.data.product.isFeatured
          ? `⭐ ${product.name} featured on Home!`
          : `${product.name} removed from Home`
      );
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success('Product deleted.');
    } catch (err) { toast.error(err.message); }
  };

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || String(p.categoryId) === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Products ({products.length})</h1>
        <Button variant="primary" size="sm" onClick={() => setModal('add')}>
          <Plus size={16} className="mr-1" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]"
          />
        </div>
        <select
          value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]"
        >
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Products table — scrollable on mobile, card stack on small */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {search || filterCat ? 'No products match your filters.' : 'No products yet. Add one!'}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Price</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-orange-50 flex-shrink-0">
                            {p.imageUrl
                              ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-lg">🍽️</div>}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{p.name}</p>
                            {p.description && <p className="text-xs text-gray-400 truncate max-w-[180px]">{p.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{p.category?.name}</td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">
                        {p.variants?.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            {p.variants.map((v) => (
                              <span key={v.id} className="text-xs">
                                <span className="font-medium text-gray-600">{v.name}:</span>{' '}
                                <span className="text-orange-600 font-bold">Rs. {Number(v.price).toLocaleString()}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          `Rs. ${Number(p.price).toLocaleString()}`
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <Badge variant={p.isAvailable ? 'success' : 'default'}>
                            {p.isAvailable ? 'Available' : 'Unavailable'}
                          </Badge>
                          {p.isFeatured && (
                            <Badge variant="warning" className="text-[10px]">⭐ Featured</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          {/* Featured toggle */}
                          <button
                            onClick={() => handleFeature(p)}
                            title={p.isFeatured ? 'Remove from Home' : 'Feature on Home'}
                            className={`p-2 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors ${
                              p.isFeatured
                                ? 'bg-yellow-50 text-yellow-500 hover:bg-yellow-100'
                                : 'hover:bg-gray-100 text-gray-300 hover:text-yellow-400'
                            }`}
                          >
                            <Star size={16} className={p.isFeatured ? 'fill-yellow-400' : ''} />
                          </button>
                          {/* Availability toggle */}
                          <button
                            onClick={() => handleToggle(p)}
                            title={p.isAvailable ? 'Disable' : 'Enable'}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            {p.isAvailable ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                          </button>
                          <button
                            onClick={() => setModal(p)}
                            className="p-2 rounded-lg hover:bg-orange-50 text-orange-500 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-400 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card stack */}
          <div className="sm:hidden space-y-3">
            {filtered.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-orange-50 flex-shrink-0">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>}
                  {p.isFeatured && (
                    <span className="absolute top-0.5 right-0.5 bg-yellow-400 rounded-full p-0.5">
                      <Star size={9} className="fill-white text-white" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.category?.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {p.variants?.length > 0 ? (
                      <span className="text-orange-600 font-bold text-xs">
                        Rs. {Number(p.variants[0].price).toLocaleString()} – {Number(p.variants[p.variants.length-1].price).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-orange-600 font-bold text-sm">Rs. {Number(p.price).toLocaleString()}</span>
                    )}
                    <Badge variant={p.isAvailable ? 'success' : 'default'} className="text-[10px]">
                      {p.isAvailable ? 'Available' : 'Off'}
                    </Badge>
                    {p.isFeatured && (
                      <Badge variant="warning" className="text-[10px]">⭐ Home</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleFeature(p)}
                    title={p.isFeatured ? 'Remove from Home' : 'Feature on Home'}
                    className={`p-2 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors ${
                      p.isFeatured ? 'bg-yellow-50 text-yellow-500' : 'hover:bg-gray-100 text-gray-300'
                    }`}
                  >
                    <Star size={15} className={p.isFeatured ? 'fill-yellow-400' : ''} />
                  </button>
                  <button onClick={() => setModal(p)} className="p-2 rounded-lg hover:bg-orange-50 text-orange-500 min-h-[36px] min-w-[36px] flex items-center justify-center">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleToggle(p)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 min-h-[36px] min-w-[36px] flex items-center justify-center">
                    {p.isAvailable ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {modal && (
        <ProductModal
          product={modal === 'add' ? null : modal}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchProducts(); }}
        />
      )}
    </div>
  );
};

export default AdminProductsPage;
