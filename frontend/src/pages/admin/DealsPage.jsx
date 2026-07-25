import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Image, Upload, Minus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

// ── Deal Form Modal ───────────────────────────────────────────────────────────
const DealModal = ({ deal, products, onClose, onSaved }) => {
  const [form, setForm] = useState({
    title:       deal?.title       || '',
    description: deal?.description || '',
    dealPrice:   deal?.dealPrice   ? String(deal.dealPrice) : '',
  });
  const [items, setItems] = useState(
    deal?.items?.length
      ? deal.items.map((i) => ({
          type:        i.type, // Use the type directly from shapeDeal
          productId:   i.productId ? String(i.productId) : '',
          quantity:    i.quantity || 1,
          customName:  i.customName || (i.type === 'custom' ? i.productName : ''), // Fallback to productName if customName is missing
          customPrice: i.customPrice ? String(i.customPrice) : (i.type === 'custom' ? String(i.productPrice) : ''), // Fallback to productPrice for custom items
        }))
      : [{ type: 'menu', productId: '', quantity: 1, customName: '', customPrice: '' }]
  );
  const [imageFile, setImageFile] = useState(null);
  const [preview,   setPreview]   = useState(deal?.imageUrl || null);
  const [errors,    setErrors]    = useState({});
  const [loading,   setLoading]   = useState(false);
  const fileRef = useRef();

  const setField = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const addItem    = () => setItems((p) => [...p, { type: 'menu', productId: '', quantity: 1, customName: '', customPrice: '' }]);
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i));
  const setItem    = (i, field, val) =>
    setItems((p) => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  // Toggle row between menu picker and custom manual input
  const toggleType = (i, type) =>
    setItems((p) => p.map((it, idx) =>
      idx === i ? { ...it, type, productId: '', customName: '', customPrice: '' } : it
    ));

  // Live calculated total — menu items use product price, custom items use customPrice
  const calculatedTotal = items.reduce((sum, it) => {
    if (it.type === 'menu') {
      const p = products.find((pr) => String(pr.id) === String(it.productId));
      return sum + (p ? Number(p.price) * (Number(it.quantity) || 1) : 0);
    } else {
      return sum + (Number(it.customPrice) || 0) * (Number(it.quantity) || 1);
    }
  }, 0);

  // One-click: copy calculated total into price field
  const applyCalculated = () => {
    if (calculatedTotal > 0)
      setForm((p) => ({ ...p, dealPrice: String(calculatedTotal) }));
  };

  const dealPriceNum = Number(form.dealPrice);
  const savings      = calculatedTotal > 0 && dealPriceNum > 0 ? calculatedTotal - dealPriceNum : 0;
  const savingsPct   = calculatedTotal > 0 && savings > 0
    ? Math.round((savings / calculatedTotal) * 100) : 0;

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required.';
    if (!form.dealPrice || isNaN(dealPriceNum) || dealPriceNum < 0)
      e.dealPrice = 'Valid price is required.';
    // Products are optional — admin can rely on description alone
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title',       form.title.trim());
      fd.append('description', form.description.trim());
      fd.append('dealPrice',   form.dealPrice);
      const validItems = items
        .filter((it) => it.type === 'menu' ? it.productId : it.customName.trim())
        .map((it) => it.type === 'menu'
          ? { productId: Number(it.productId), quantity: Number(it.quantity) || 1 }
          : { customName: it.customName.trim(), customPrice: Number(it.customPrice) || 0, quantity: Number(it.quantity) || 1 }
        );
      fd.append('items', JSON.stringify(validItems));
      if (imageFile) fd.append('image', imageFile);

      if (deal) {
        await api.patch(`/deals/${deal.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Deal updated!');
      } else {
        await api.post('/deals', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Deal created!');
      }
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
      <div className="relative bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">{deal ? 'Edit Deal' : 'Create Deal'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-5">

            {/* ── Image ── */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Deal Image (optional)</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-orange-400 transition-colors"
              >
                {preview ? (
                  <div className="relative h-36">
                    <img src={preview} alt="preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <p className="text-white text-sm font-medium flex items-center gap-1"><Upload size={14} /> Change</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-24 flex flex-col items-center justify-center gap-2 text-gray-400">
                    <Image size={28} /><p className="text-xs">Click to upload</p>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </div>

            {/* ── Title ── */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Deal Title <span className="text-red-500">*</span>
              </label>
              <input
                value={form.title} onChange={setField('title')}
                placeholder="e.g. Family BBQ Bundle"
                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${errors.title ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">⚠ {errors.title}</p>}
            </div>

            {/* ── Description — manual text ── */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Description
                <span className="ml-1.5 text-xs text-gray-400 font-normal">
                  — write what's included in this deal
                </span>
              </label>
              <textarea
                value={form.description} onChange={setField('description')} rows={3}
                placeholder="e.g. 1x Chicken Karahi (1kg) + 4x Naan + 1 Soft Drink — perfect for a family of 4"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>

            {/* ── Product Picker — for price calculation ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Add Products
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">
                    — select to auto-calculate total price
                  </span>
                </label>
                {items.length < 8 && (
                  <button
                    type="button" onClick={addItem}
                    style={{ minHeight: 'unset', minWidth: 'unset' }}
                    className="flex items-center gap-1 text-xs text-orange-500 font-semibold hover:text-orange-600 px-2 py-1 rounded-lg hover:bg-orange-50"
                  >
                    <Plus size={13} /> Add Row
                  </button>
                )}
              </div>
              {errors.items && <p className="text-xs text-red-500 mb-2">⚠ {errors.items}</p>}

              <div className="space-y-2">
                {items.map((item, i) => {
                  const selProd = item.type === 'menu'
                    ? products.find((p) => String(p.id) === String(item.productId))
                    : null;
                  const rowTotal = item.type === 'menu'
                    ? (selProd ? Number(selProd.price) * item.quantity : 0)
                    : (Number(item.customPrice) || 0) * item.quantity;

                  return (
                    <div key={i} className="bg-gray-50 rounded-xl p-2 space-y-2">
                      {/* Toggle — From Menu / Custom */}
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleType(i, 'menu')}
                          style={{ minHeight: 'unset', minWidth: 'unset' }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            item.type === 'menu'
                              ? 'bg-orange-500 text-white'
                              : 'bg-white border border-gray-200 text-gray-500 hover:border-orange-300'
                          }`}
                        >
                          From Menu
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleType(i, 'custom')}
                          style={{ minHeight: 'unset', minWidth: 'unset' }}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            item.type === 'custom'
                              ? 'bg-orange-500 text-white'
                              : 'bg-white border border-gray-200 text-gray-500 hover:border-orange-300'
                          }`}
                        >
                          Custom Item
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Thumb */}
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-orange-100 flex-shrink-0">
                          {selProd?.imageUrl
                            ? <img src={selProd.imageUrl} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-sm">🍽️</div>}
                        </div>

                        {item.type === 'menu' ? (
                          /* Menu picker dropdown */
                          <select
                            value={item.productId}
                            onChange={(e) => setItem(i, 'productId', e.target.value)}
                            style={{ minHeight: 'unset' }}
                            className="flex-1 rounded-lg border border-gray-200 px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                          >
                            <option value="">Select product...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} — Rs. {Number(p.price).toLocaleString()}
                              </option>
                            ))}
                          </select>
                        ) : (
                          /* Custom manual inputs */
                          <div className="flex-1 flex gap-1.5">
                            <input
                              value={item.customName}
                              onChange={(e) => setItem(i, 'customName', e.target.value)}
                              placeholder="Item name (e.g. Naan)"
                              style={{ minHeight: 'unset' }}
                              className="flex-1 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                            />
                            <input
                              type="number" min="0"
                              value={item.customPrice}
                              onChange={(e) => setItem(i, 'customPrice', e.target.value)}
                              placeholder="Price"
                              style={{ minHeight: 'unset' }}
                              className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                            />
                          </div>
                        )}

                        {/* Qty stepper */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button type="button" style={{ minHeight: 'unset', minWidth: 'unset' }}
                            onClick={() => setItem(i, 'quantity', Math.max(1, item.quantity - 1))}
                            className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-orange-400"
                          ><Minus size={12} /></button>
                          <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                          <button type="button" style={{ minHeight: 'unset', minWidth: 'unset' }}
                            onClick={() => setItem(i, 'quantity', item.quantity + 1)}
                            className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:border-orange-400"
                          ><Plus size={12} /></button>
                        </div>

                        {/* Row subtotal */}
                        {rowTotal > 0 && (
                          <span className="text-xs text-gray-500 font-medium w-20 text-right flex-shrink-0">
                            Rs. {rowTotal.toLocaleString()}
                          </span>
                        )}

                        {/* Remove row */}
                        {items.length > 1 && (
                          <button type="button" style={{ minHeight: 'unset', minWidth: 'unset' }}
                            onClick={() => removeItem(i)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"
                          ><X size={14} /></button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Calculated total + apply button */}
              {calculatedTotal > 0 && (
                <div className="mt-3 flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-[11px] text-orange-500 font-semibold uppercase tracking-wide">
                      Calculated Total
                    </p>
                    <p className="text-xl font-extrabold text-orange-700">
                      Rs. {calculatedTotal.toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button" onClick={applyCalculated}
                    style={{ minHeight: 'unset', minWidth: 'unset' }}
                    className="text-xs bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-2 rounded-lg transition-colors"
                  >
                    Use this ↓
                  </button>
                </div>
              )}
            </div>

            {/* ── Deal Price — admin sets manually ── */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Deal Price (Rs.) <span className="text-red-500">*</span>
                <span className="ml-1.5 text-xs text-gray-400 font-normal">
                  — set any price you want
                </span>
              </label>
              <input
                type="number" min="0" step="1"
                value={form.dealPrice} onChange={setField('dealPrice')}
                placeholder="Enter deal price manually..."
                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${errors.dealPrice ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.dealPrice && <p className="text-xs text-red-500 mt-1">⚠ {errors.dealPrice}</p>}

              {/* Live savings hint */}
              {calculatedTotal > 0 && dealPriceNum > 0 && (
                <p className={`text-xs mt-1.5 font-medium ${savings > 0 ? 'text-green-600' : savings < 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {savings > 0
                    ? `✅ Customer saves Rs. ${savings.toLocaleString()} (${savingsPct}% off)`
                    : savings < 0
                    ? `⚠ Rs. ${Math.abs(savings).toLocaleString()} above calculated total`
                    : 'Deal price = calculated total'}
                </p>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex gap-3 flex-shrink-0 border-t border-gray-100 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" isLoading={loading} className="flex-1">
              {deal ? 'Save Changes' : 'Create Deal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Deals Page ───────────────────────────────────────────────────────────
const AdminDealsPage = () => {
  const [deals,    setDeals]    = useState([]);
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);

  const fetchDeals = async () => {
    try {
      const [dRes, pRes] = await Promise.all([
        api.get('/deals?active=false'),
        api.get('/products'),
      ]);
      setDeals(dRes.data.data.deals || []);
      setProducts(pRes.data.data.products || []);
    } catch (err) {
      toast.error('Failed to load data. Please refresh.');
      // Try fetching products separately so dropdown still works
      try {
        const pRes = await api.get('/products');
        setProducts(pRes.data.data.products || []);
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDeals(); }, []);

  const handleToggle = async (deal) => {
    try {
      const res = await api.patch(`/deals/${deal.id}/toggle`);
      setDeals((prev) => prev.map((d) => d.id === deal.id ? res.data.data.deal : d));
      toast.success(`Deal ${res.data.data.deal.isActive ? 'activated' : 'deactivated'}`);
    } catch (err) { toast.error(err.message); }
  };

  const handleFeature = async (deal) => {
    try {
      const res = await api.patch(`/deals/${deal.id}/feature`);
      setDeals((prev) => prev.map((d) => d.id === deal.id ? res.data.data.deal : d));
      toast.success(`Deal ${res.data.data.deal.isFeatured ? '⭐ Featured on Home!' : 'removed from Home'}`);
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (deal) => {
    if (!window.confirm(`Delete "${deal.title}"?`)) return;
    try {
      await api.delete(`/deals/${deal.id}`);
      setDeals((prev) => prev.filter((d) => d.id !== deal.id));
      toast.success('Deal deleted.');
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Hot Deals ({deals.length})</h1>
        <Button variant="primary" size="sm" onClick={() => setModal('add')}>
          <Plus size={16} className="mr-1" /> Create Deal
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : deals.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-3">🔥</div>
          <p className="font-medium">No deals yet</p>
          <p className="text-sm mt-1 mb-5">Create your first deal!</p>
          <Button variant="primary" onClick={() => setModal('add')}>
            <Plus size={16} className="mr-1" /> Create First Deal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map((deal) => {
            const originalPrice = deal.items?.reduce((s, it) => s + it.productPrice * it.quantity, 0) || 0;
            const savings = originalPrice - deal.dealPrice;
            const pct = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

            return (
              <div key={deal.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border-2 transition-colors ${deal.isActive ? 'border-transparent' : 'border-gray-200 opacity-60'}`}>
                <div className="h-36 bg-gradient-to-br from-orange-100 to-amber-50 relative overflow-hidden">
                  {deal.imageUrl
                    ? <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl">🔥</div>}
                  {pct > 0 && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-extrabold px-2 py-1 rounded-full">-{pct}%</div>
                  )}
                  {deal.isFeatured && (
                    <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-extrabold px-2 py-1 rounded-full flex items-center gap-1">
                      ⭐ Featured
                    </div>
                  )}
                  {!deal.isActive && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <span className="bg-white text-gray-700 text-xs font-bold px-3 py-1 rounded-full">Inactive</span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 text-sm">{deal.title}</h3>
                    <Badge variant={deal.isActive ? 'success' : 'default'} className="text-[10px] flex-shrink-0">
                      {deal.isActive ? 'Active' : 'Off'}
                    </Badge>
                  </div>

                  {deal.description && (
                    <p className="text-xs text-gray-400 mb-3 line-clamp-2">{deal.description}</p>
                  )}

                  {deal.items?.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {deal.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                          <div className="w-5 h-5 rounded overflow-hidden bg-orange-50 flex-shrink-0">
                            {item.productImageUrl
                              ? <img src={item.productImageUrl} alt="" className="w-full h-full object-cover" />
                              : <span className="flex items-center justify-center h-full text-[10px]">🍽️</span>}
                          </div>
                          <span className="flex-1 truncate">{item.productName}</span>
                          <span className="text-gray-400">×{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-extrabold text-orange-600">
                      Rs. {Number(deal.dealPrice).toLocaleString()}
                    </span>
                    {originalPrice > deal.dealPrice && (
                      <span className="text-xs text-gray-400 line-through">Rs. {originalPrice.toLocaleString()}</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleToggle(deal)} style={{ minHeight: 'unset' }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:border-orange-400 hover:text-orange-500 transition-colors"
                    >
                      {deal.isActive
                        ? <><ToggleRight size={14} className="text-green-500" /> Active</>
                        : <><ToggleLeft size={14} /> Inactive</>}
                    </button>
                    <button onClick={() => handleFeature(deal)} style={{ minHeight: 'unset' }}
                      title={deal.isFeatured ? 'Remove from Home' : 'Feature on Home'}
                      className={`p-2 rounded-xl border transition-colors ${
                        deal.isFeatured
                          ? 'border-yellow-300 bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                          : 'border-gray-200 text-gray-400 hover:border-yellow-300 hover:text-yellow-500'
                      }`}
                    >⭐</button>
                    <button onClick={() => setModal(deal)} style={{ minHeight: 'unset' }}
                      className="p-2 rounded-xl border border-gray-200 text-orange-500 hover:border-orange-400 hover:bg-orange-50 transition-colors"
                    ><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(deal)} style={{ minHeight: 'unset' }}
                      className="p-2 rounded-xl border border-gray-200 text-red-400 hover:border-red-300 hover:bg-red-50 transition-colors"
                    ><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <DealModal
          deal={modal === 'add' ? null : modal}
          products={products}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchDeals(); }}
        />
      )}
    </div>
  );
};

export default AdminDealsPage;
