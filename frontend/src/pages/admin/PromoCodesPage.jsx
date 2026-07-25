import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Tag, Users, TrendingUp, Copy, ToggleLeft, ToggleRight, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const isExpired = (d) => d && new Date() > new Date(d);

// ── Toggle ────────────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative flex-shrink-0 inline-flex items-center w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1 ${checked ? 'bg-orange-500' : 'bg-gray-300'}`}
  >
    <span
      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${checked ? 'translate-x-7' : 'translate-x-1'}`}
    />
  </button>
);

// ── Field wrapper ─────────────────────────────────────────────────────────────
const Field = ({ label, children, hint }) => (
  <div>
    <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
    {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
    {children}
  </div>
);

const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[42px]';

// ── Multi-select dropdown for categories / products ───────────────────────────
const MultiSelect = ({ label, hint, items, selected, onChange, placeholder, groupByCategoryId }) => {
  const [open, setOpen] = useState(false);
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  // Group products by category if needed
  const grouped = groupByCategoryId
    ? items.reduce((acc, item) => {
        const cat = item.category?.name || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
      }, {})
    : null;

  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${inputCls} flex items-center justify-between text-left`}
        >
          <span className={selected.length ? 'text-gray-900 font-medium' : 'text-gray-400'}>
            {selected.length ? `${selected.length} item${selected.length > 1 ? 's' : ''} selected` : placeholder}
          </span>
          <ChevronDown size={15} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400 text-center">No items found</p>
            ) : grouped ? (
              // Grouped by category
              Object.entries(grouped).map(([catName, catItems]) => (
                <div key={catName}>
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100">
                    {catName}
                  </p>
                  {catItems.map((item) => (
                    <label key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={() => toggle(item.id)}
                        className="w-4 h-4 accent-orange-500 rounded flex-shrink-0"
                      />
                      <span className="text-sm text-gray-800 flex-1">{item.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">Rs. {Number(item.price).toLocaleString()}</span>
                    </label>
                  ))}
                </div>
              ))
            ) : (
              items.map((item) => (
                <label key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={() => toggle(item.id)}
                    className="w-4 h-4 accent-orange-500 rounded flex-shrink-0"
                  />
                  <span className="text-sm text-gray-800">{item.name}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((id) => {
            const item = items.find((i) => i.id === id);
            return item ? (
              <span key={id} className="flex items-center gap-1 bg-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-lg font-semibold">
                {item.name}
                <button type="button" onClick={() => toggle(id)} className="ml-0.5 hover:text-red-500 transition-colors">
                  <X size={11} />
                </button>
              </span>
            ) : null;
          })}
        </div>
      )}
    </Field>
  );
};

// ── PromoModal ────────────────────────────────────────────────────────────────
const PromoModal = ({ promo, onClose, onSaved }) => {
  const isEdit = Boolean(promo);
  const [form, setForm] = useState({
    code:           promo?.code           || '',
    description:    promo?.description    || '',
    discountType:   promo?.discountType   || 'PERCENTAGE',
    discountValue:  promo?.discountValue  != null ? String(promo.discountValue)  : '',
    minOrderAmount: promo?.minOrderAmount != null ? String(promo.minOrderAmount) : '',
    maxDiscount:    promo?.maxDiscount    != null ? String(promo.maxDiscount)    : '',
    usageLimit:     promo?.usageLimit     != null ? String(promo.usageLimit)     : '',
    perUserLimit:   promo?.perUserLimit   != null ? String(promo.perUserLimit)   : '1',
    expiresAt:      promo?.expiresAt ? new Date(promo.expiresAt).toISOString().split('T')[0] : '',
    isActive:       promo?.isActive ?? true,
    applicableProductIds:  promo?.applicableProductIds  || [],
    applicableCategoryIds: promo?.applicableCategoryIds || [],
  });

  // Scope: 'all' | 'category' | 'product'
  const [scope, setScope] = useState(() => {
    if (promo?.applicableProductIds?.length > 0)  return 'product';
    if (promo?.applicableCategoryIds?.length > 0) return 'category';
    return 'all';
  });

  const [categories, setCategories] = useState([]);
  const [products,   setProducts]   = useState([]);
  const [loading,    setLoading]    = useState(false);

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.data.categories || [])).catch(() => {});
    api.get('/products').then((r) => setProducts(r.data.data.products || [])).catch(() => {});
  }, []);

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleScopeChange = (val) => {
    setScope(val);
    setForm((p) => ({ ...p, applicableProductIds: [], applicableCategoryIds: [] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.code.trim()) { toast.error('Code is required.'); return; }
    if (!form.discountValue || Number(form.discountValue) <= 0) { toast.error('Discount value must be positive.'); return; }
    if (form.discountType === 'PERCENTAGE' && Number(form.discountValue) > 100) { toast.error('Percentage cannot exceed 100.'); return; }
    if (scope === 'product'  && form.applicableProductIds.length  === 0) { toast.error('Select at least one product.'); return; }
    if (scope === 'category' && form.applicableCategoryIds.length === 0) { toast.error('Select at least one category.'); return; }

    setLoading(true);
    try {
      const body = {
        description:           form.description.trim() || undefined,
        discountType:          form.discountType,
        discountValue:         Number(form.discountValue),
        minOrderAmount:        form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
        maxDiscount:           form.maxDiscount    ? Number(form.maxDiscount)    : undefined,
        usageLimit:            form.usageLimit     ? Number(form.usageLimit)     : undefined,
        perUserLimit:          Number(form.perUserLimit) || 1,
        expiresAt:             form.expiresAt || undefined,
        isActive:              form.isActive,
        applicableProductIds:  scope === 'product'  ? form.applicableProductIds  : [],
        applicableCategoryIds: scope === 'category' ? form.applicableCategoryIds : [],
      };

      if (!isEdit) body.code = form.code.trim().toUpperCase();

      if (isEdit) {
        await api.patch(`/admin/promos/${promo.id}`, body);
        toast.success('Promo code updated!');
      } else {
        await api.post('/admin/promos', body);
        toast.success('Promo code created!');
      }
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Failed to save promo code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">{isEdit ? 'Edit Promo Code' : 'New Promo Code'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 min-h-[40px] min-w-[40px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!isEdit && (
            <Field label="Promo Code *" hint="Customers will type this exactly. Auto-uppercased.">
              <input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. PIZZA25 / EID50 / FLAT100"
                className={`${inputCls} font-mono tracking-widest uppercase font-bold`} />
            </Field>
          )}

          <Field label="Description (optional)" hint="Shown to customer when code is applied">
            <input value={form.description} onChange={set('description')}
              placeholder="e.g. 25% off on all pizzas"
              className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount Type *">
              <select value={form.discountType} onChange={set('discountType')} className={inputCls}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat (Rs.)</option>
              </select>
            </Field>
            <Field label={`Value * ${form.discountType === 'PERCENTAGE' ? '(%)' : '(Rs.)'}`}>
              <input type="number" min="1" max={form.discountType === 'PERCENTAGE' ? '100' : undefined}
                step="0.01" value={form.discountValue} onChange={set('discountValue')}
                placeholder={form.discountType === 'PERCENTAGE' ? 'e.g. 25' : 'e.g. 100'}
                className={inputCls} />
            </Field>
          </div>

          {form.discountType === 'PERCENTAGE' && (
            <Field label="Max Discount Cap (Rs.)" hint="Optional: cap the discount amount">
              <input type="number" min="1" step="1" value={form.maxDiscount} onChange={set('maxDiscount')}
                placeholder="e.g. 500 (leave empty = no cap)" className={inputCls} />
            </Field>
          )}

          <Field label="Minimum Order Amount (Rs.)" hint="Optional: code only applies if order ≥ this">
            <input type="number" min="0" step="1" value={form.minOrderAmount} onChange={set('minOrderAmount')}
              placeholder="e.g. 300 (leave empty = no minimum)" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Usage Limit" hint="Leave empty = unlimited">
              <input type="number" min="1" step="1" value={form.usageLimit} onChange={set('usageLimit')}
                placeholder="e.g. 100" className={inputCls} />
            </Field>
            <Field label="Per User Limit">
              <input type="number" min="1" step="1" value={form.perUserLimit} onChange={set('perUserLimit')}
                placeholder="1" className={inputCls} />
            </Field>
          </div>

          <Field label="Expiry Date (optional)">
            <input type="date" value={form.expiresAt} onChange={set('expiresAt')}
              min={new Date().toISOString().split('T')[0]} className={inputCls} />
          </Field>

          {/* ── Applies To ── */}
          <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Tag size={14} className="text-orange-500" /> Applies To
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Restrict this code to specific items, or apply to the entire order.</p>
            </div>

            {/* Scope tabs */}
            <div className="flex gap-2">
              {[
                ['all',      '🧾 Entire Order'],
                ['category', '📂 Category'],
                ['product',  '🍕 Product'],
              ].map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleScopeChange(val)}
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-bold border-2 transition-all ${
                    scope === val
                      ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300 hover:text-orange-600'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {scope === 'all' && (
              <p className="text-xs text-gray-500 bg-white rounded-lg px-3 py-2.5 border border-gray-100">
                ✅ Discount will apply to the <strong>full order total</strong>.
              </p>
            )}

            {scope === 'category' && (
              <MultiSelect
                label="Select Categories"
                hint="Discount applies only to items from these categories"
                items={categories}
                selected={form.applicableCategoryIds}
                onChange={(ids) => setForm((p) => ({ ...p, applicableCategoryIds: ids }))}
                placeholder="Choose categories..."
              />
            )}

            {scope === 'product' && (
              <MultiSelect
                label="Select Products"
                hint="Discount applies only to these specific products"
                items={products}
                selected={form.applicableProductIds}
                onChange={(ids) => setForm((p) => ({ ...p, applicableProductIds: ids }))}
                placeholder="Choose products..."
                groupByCategoryId
              />
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-800">Active</p>
              <p className="text-xs text-gray-400 mt-0.5">Inactive codes cannot be applied at checkout</p>
            </div>
            <Toggle checked={form.isActive} onChange={() => setForm((p) => ({ ...p, isActive: !p.isActive }))} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" isLoading={loading} className="flex-1">
              {isEdit ? 'Save Changes' : 'Create Code'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Usage Drawer ──────────────────────────────────────────────────────────────
const UsageDrawer = ({ promo, onClose }) => {
  const [usages,  setUsages]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/promos/${promo.id}/usages`)
      .then((r) => setUsages(r.data.data.usages))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [promo.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Usage — {promo.code}</h2>
            <p className="text-xs text-gray-400">{promo.usageCount} uses total</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 min-h-[40px] min-w-[40px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : usages.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No usages yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {usages.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm flex-shrink-0">
                    {u.user?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.user?.name}</p>
                    <p className="text-xs text-gray-400">{u.user?.phone || u.user?.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-green-600">−Rs. {fmt(u.discount)}</p>
                    <p className="text-xs text-gray-400">{fmtDate(u.usedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const PromoCodesPage = () => {
  const [promos,  setPromos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [drawer,  setDrawer]  = useState(null);
  const [filter,  setFilter]  = useState('all');

  const fetchPromos = async () => {
    try {
      const res = await api.get('/admin/promos');
      setPromos(res.data.data.promos);
    } catch { /* keep */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPromos(); }, []);

  const handleToggle = async (promo) => {
    try {
      await api.patch(`/admin/promos/${promo.id}`, { isActive: !promo.isActive });
      setPromos((prev) => prev.map((p) => p.id === promo.id ? { ...p, isActive: !p.isActive } : p));
      toast.success(promo.isActive ? 'Promo deactivated.' : 'Promo activated!');
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async (promo) => {
    if (!window.confirm(`Delete "${promo.code}"?\n\nIf it has usage history, deactivate instead.`)) return;
    try {
      await api.delete(`/admin/promos/${promo.id}`);
      setPromos((prev) => prev.filter((p) => p.id !== promo.id));
      toast.success('Deleted.');
    } catch (err) { toast.error(err.message); }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => toast.success(`Copied: ${code}`));
  };

  const displayed = promos.filter((p) => {
    if (filter === 'active')   return p.isActive && !isExpired(p.expiresAt);
    if (filter === 'inactive') return !p.isActive || isExpired(p.expiresAt);
    return true;
  });

  const activeCount = promos.filter((p) => p.isActive && !isExpired(p.expiresAt)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Promo Codes</h1>
        <Button variant="primary" size="sm" onClick={() => setModal('new')}>
          <Plus size={16} className="mr-1" /> New Promo Code
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Codes', value: promos.length,                                              color: 'text-orange-600', bg: 'bg-orange-50', icon: Tag      },
          { label: 'Active',      value: activeCount,                                                 color: 'text-green-600',  bg: 'bg-green-50',  icon: TrendingUp },
          { label: 'Total Used',  value: promos.reduce((s, p) => s + (p.usageCount || 0), 0),        color: 'text-blue-600',   bg: 'bg-blue-50',   icon: Users    },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={`${bg} rounded-2xl p-4 text-center`}>
            <Icon size={16} className={`${color} mx-auto mb-1`} />
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
        {[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-[36px] ${filter === val ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
          <Tag size={36} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No promo codes yet</p>
          <p className="text-sm mt-1">Create your first promo to offer discounts to customers.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((p) => {
            const expired   = isExpired(p.expiresAt);
            const statusOk  = p.isActive && !expired;
            const restricted = (p.applicableProductIds?.length > 0) || (p.applicableCategoryIds?.length > 0);
            return (
              <div key={p.id} className={`bg-white rounded-2xl shadow-sm border-l-4 p-4 transition-all ${statusOk ? 'border-orange-400' : 'border-gray-200 opacity-70'}`}>
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-lg text-gray-900 tracking-widest">{p.code}</span>
                    <button onClick={() => copyCode(p.code)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Copy code">
                      <Copy size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.discountType === 'PERCENTAGE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {p.discountType === 'PERCENTAGE' ? `${p.discountValue}% OFF` : `Rs. ${fmt(p.discountValue)} OFF`}
                    </span>
                    {restricted && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                        {p.applicableProductIds?.length > 0 ? `${p.applicableProductIds.length} product(s)` : `${p.applicableCategoryIds?.length} category(s)`}
                      </span>
                    )}
                    {statusOk ? <Badge variant="success">Active</Badge> : <Badge variant="default">{expired ? 'Expired' : 'Inactive'}</Badge>}
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button onClick={() => setDrawer(p)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-400 transition-colors" title="View usages"><Users size={15} /></button>
                    <button onClick={() => setModal(p)} className="p-2 rounded-lg hover:bg-orange-50 text-orange-400 transition-colors" title="Edit"><Pencil size={15} /></button>
                    <button onClick={() => handleToggle(p)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title={p.isActive ? 'Deactivate' : 'Activate'}>
                      {p.isActive ? <ToggleRight size={17} className="text-orange-500" /> : <ToggleLeft size={17} />}
                    </button>
                    <button onClick={() => handleDelete(p)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Delete"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-gray-400">
                  {p.description && <span className="text-gray-500 italic w-full mb-0.5">{p.description}</span>}
                  {p.minOrderAmount && <span>Min order: Rs. {fmt(p.minOrderAmount)}</span>}
                  {p.maxDiscount    && <span>Max discount: Rs. {fmt(p.maxDiscount)}</span>}
                  {p.usageLimit ? <span>Used: <strong className="text-gray-700">{p.usageCount}</strong> / {p.usageLimit}</span> : <span>Used: <strong className="text-gray-700">{p.usageCount}</strong> / ∞</span>}
                  <span>Per user: {p.perUserLimit}×</span>
                  {p.expiresAt && <span className={expired ? 'text-red-400 font-semibold' : ''}>{expired ? 'Expired' : 'Expires'}: {fmtDate(p.expiresAt)}</span>}
                </div>
                {p.usageLimit && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${p.usageCount / p.usageLimit > 0.8 ? 'bg-red-400' : 'bg-orange-400'}`}
                        style={{ width: `${Math.min(100, (p.usageCount / p.usageLimit) * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 text-right">{Math.round((p.usageCount / p.usageLimit) * 100)}% used</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <PromoModal promo={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); fetchPromos(); }} />
      )}
      {drawer && (
        <UsageDrawer promo={drawer} onClose={() => setDrawer(null)} />
      )}
    </div>
  );
};

export default PromoCodesPage;
