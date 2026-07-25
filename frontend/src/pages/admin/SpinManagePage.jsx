import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, X, CheckCircle, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

// ── Prize Form Modal ──────────────────────────────────────────────────────────
const PrizeModal = ({ prize, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: prize?.name || '',
    description: prize?.description || '',
    weight: prize?.weight !== undefined ? String(prize.weight) : '10',
    stockRemaining: prize?.stockRemaining !== null && prize?.stockRemaining !== undefined ? String(prize.stockRemaining) : '',
    color: prize?.color || '#FF6B6B',
    isActive: prize?.isActive ?? true,
  });
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(prize?.imageUrl || null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.weight) {
      toast.error('Name and weight are required.');
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('description', form.description.trim());
      fd.append('weight', form.weight);
      fd.append('color', form.color);
      fd.append('isActive', String(form.isActive));
      if (form.stockRemaining !== '') fd.append('stockRemaining', form.stockRemaining);
      if (imageFile) fd.append('image', imageFile);

      if (prize) {
        await api.patch(`/admin/spin/prizes/${prize.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Prize updated!');
      } else {
        await api.post('/admin/spin/prizes', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Prize added!');
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
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">{prize ? 'Edit Prize' : 'Add Prize'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Image */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:border-orange-400 h-28 flex items-center justify-center"
            style={{ backgroundColor: form.color + '22' }}
          >
            {preview
              ? <img src={preview} alt="" className="h-full object-contain" />
              : <p className="text-gray-400 text-sm">Click to upload image (optional)</p>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setPreview(URL.createObjectURL(f)); } }} />

          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Prize Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Free Drink"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Description</label>
            <input value={form.description} onChange={set('description')} placeholder="Short description..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
          </div>

          {/* Weight + Color row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Weight <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1 text-xs">(higher = more common)</span>
              </label>
              <input type="number" min="1" value={form.weight} onChange={set('weight')}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Wheel Color</label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 min-h-[44px]">
                <input type="color" value={form.color} onChange={set('color')} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                <span className="text-sm text-gray-500">{form.color}</span>
              </div>
            </div>
          </div>

          {/* Stock */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              Stock Limit
              <span className="text-gray-400 font-normal ml-1 text-xs">(leave empty = unlimited)</span>
            </label>
            <input type="number" min="0" value={form.stockRemaining} onChange={set('stockRemaining')} placeholder="Unlimited"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-gray-700">Active on wheel</p>
              <p className="text-xs text-gray-400">Inactive prizes won't appear</p>
            </div>
            <button type="button" onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${form.isActive ? 'bg-orange-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" isLoading={loading} className="flex-1">
              {prize ? 'Save Changes' : 'Add Prize'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Spin Management Page ─────────────────────────────────────────────────
const AdminSpinPage = () => {
  const [prizes, setPrizes] = useState([]);
  const [history, setHistory] = useState([]);
  const [config, setConfig] = useState({ dailyLimit: 1 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('prizes'); // 'prizes' | 'history' | 'config'
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchAll = async () => {
    try {
      const [pRes, hRes, cRes] = await Promise.all([
        api.get('/admin/spin/prizes'),
        api.get('/admin/spin/history?limit=30'),
        api.get('/spin/config'),
      ]);
      setPrizes(pRes.data.data.prizes);
      setHistory(hRes.data.data.history);
      setConfig({ dailyLimit: cRes.data.data.dailyLimit });
    } catch { /* keep */ }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); }, []);

  const handleRedeem = async (id) => {
    try {
      await api.patch(`/admin/spin/history/${id}/redeem`);
      setHistory((prev) => prev.map((h) => h.id === id ? { ...h, redeemed: true } : h));
      toast.success('Marked as redeemed!');
    } catch (err) { toast.error(err.message); }
  };

  const handleDeletePrize = async (prize) => {
    if (!window.confirm(`Delete "${prize.name}"?\n\nNote: If this prize has spin history, it cannot be deleted — deactivate it instead.`)) return;
    try {
      await api.delete(`/admin/spin/prizes/${prize.id}`);
      setPrizes((prev) => prev.filter((p) => p.id !== prize.id));
      toast.success('Prize deleted.');
    } catch (err) { toast.error(err.message); }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.patch('/admin/spin/config', { dailySpinLimit: config.dailyLimit });
      toast.success('Config saved!');
    } catch (err) { toast.error(err.message); }
    finally { setSavingConfig(false); }
  };

  // Calculate total weight for probability display
  const totalWeight = prizes.filter((p) => p.isActive).reduce((s, p) => s + p.weight, 0);

  const TABS = [
    { key: 'prizes', label: 'Prizes' },
    { key: 'history', label: 'Spin History' },
    { key: 'config', label: 'Settings' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Spin & Win</h1>
        {tab === 'prizes' && (
          <Button variant="primary" size="sm" onClick={() => setModal('add')}>
            <Plus size={16} className="mr-1" /> Add Prize
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-[40px] ${tab === key ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* ── Prizes Tab ── */}
          {tab === 'prizes' && (
            <div className="space-y-4">
              {prizes.length === 0 ? (
                <div className="text-center py-16 text-gray-400">No prizes yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {prizes.map((p) => {
                    const prob = totalWeight > 0 ? ((p.weight / totalWeight) * 100).toFixed(1) : 0;
                    return (
                      <div key={p.id} className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${p.isActive ? 'opacity-100' : 'opacity-50'}`}
                        style={{ borderLeftColor: p.color }}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                              style={{ backgroundColor: p.color + '22' }}>
                              {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-xl" /> : '🎁'}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                              <p className="text-xs text-gray-400">{p.description}</p>
                            </div>
                          </div>
                          <button onClick={() => setModal(p)}
                            className="p-2 rounded-lg hover:bg-orange-50 text-orange-500 min-h-[36px] min-w-[36px] flex items-center justify-center">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDeletePrize(p)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-400 min-h-[36px] min-w-[36px] flex items-center justify-center">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <span className="text-gray-500">Weight: </span>
                            <span className="font-bold text-gray-900">{p.weight}</span>
                            <span className="text-gray-400 ml-1">({prob}% chance)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {p.stockRemaining !== null && (
                              <span className="text-gray-500">Stock: {p.stockRemaining}</span>
                            )}
                            <Badge variant={p.isActive ? 'success' : 'default'}>
                              {p.isActive ? 'Active' : 'Off'}
                            </Badge>
                          </div>
                        </div>
                        {/* Probability bar */}
                        <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${prob}%`, backgroundColor: p.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── History Tab ── */}
          {tab === 'history' && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {history.length === 0 ? (
                <div className="text-center py-16 text-gray-400">No spins yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {['User', 'Prize Won', 'When', 'Status', ''].map((h) => (
                          <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {history.map((h) => (
                        <tr key={h.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-gray-900">{h.user?.name}</p>
                            <p className="text-xs text-gray-400">{h.user?.phone || h.user?.email}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: h.prize?.color || '#ccc' }} />
                              <span className="font-medium text-gray-900">{h.prize?.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 text-xs">
                            {new Date(h.spunAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge variant={h.redeemed ? 'success' : 'warning'}>
                              {h.redeemed ? 'Redeemed' : 'Pending'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5">
                            {!h.redeemed && (
                              <button onClick={() => handleRedeem(h.id)}
                                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-semibold min-h-[36px]">
                                <CheckCircle size={14} /> Redeem
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Config Tab ── */}
          {tab === 'config' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm max-w-md">
              <div className="flex items-center gap-2 mb-5">
                <Settings size={18} className="text-orange-500" />
                <h2 className="font-bold text-gray-900">Spin Settings</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    Daily Spin Limit per User
                  </label>
                  <p className="text-xs text-gray-400 mb-2">How many spins each user gets per day</p>
                  <input
                    type="number" min="1" max="10"
                    value={config.dailyLimit}
                    onChange={(e) => setConfig({ dailyLimit: Number(e.target.value) })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px] max-w-[120px]"
                  />
                </div>
                <Button variant="primary" isLoading={savingConfig} onClick={saveConfig}>
                  Save Settings
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {modal && (
        <PrizeModal
          prize={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchAll(); }}
        />
      )}
    </div>
  );
};

export default AdminSpinPage;
