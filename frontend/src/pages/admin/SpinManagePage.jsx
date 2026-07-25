import { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, X, CheckCircle, Settings, Gift, Users, Clock,
         BarChart2, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

// ── Mini Wheel Preview ────────────────────────────────────────────────────────
const WheelPreview = ({ prizes }) => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prizes.length === 0) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 4;
    const seg = (2 * Math.PI) / prizes.length;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    prizes.forEach((p, i) => {
      const s = i * seg - Math.PI / 2, e = s + seg;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, s, e); ctx.closePath();
      ctx.fillStyle = p.color || '#F97316'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(s + seg / 2);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(7, Math.min(10, 180 / prizes.length))}px sans-serif`;
      const label = p.name.length > 10 ? p.name.slice(0, 9) + '…' : p.name;
      ctx.fillText(label, r - 6, 3); ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.strokeStyle = '#E85D04'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#E85D04'; ctx.font = '11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🎁', cx, cy);
  }, [prizes]);
  if (prizes.length === 0) return null;
  return (
    <div className="relative inline-block">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[12px] border-l-transparent border-r-transparent border-b-orange-500" />
      </div>
      <canvas ref={canvasRef} width={160} height={160} className="rounded-full shadow-lg" />
    </div>
  );
};

// ── Stats Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color = 'orange' }) => {
  const colors = {
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    green:  'bg-green-50  text-green-600  border-green-100',
    blue:   'bg-blue-50   text-blue-600   border-blue-100',
    amber:  'bg-amber-50  text-amber-600  border-amber-100',
  };
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border flex items-center gap-4 ${colors[color]}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
        <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
};

// ── Prize Form Modal ──────────────────────────────────────────────────────────
const PrizeModal = ({ prize, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name:           prize?.name || '',
    description:    prize?.description || '',
    weight:         prize?.weight !== undefined ? String(prize.weight) : '10',
    stockRemaining: prize?.stockRemaining != null ? String(prize.stockRemaining) : '',
    color:          prize?.color || '#F97316',
    isActive:       prize?.isActive ?? true,
  });
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview]     = useState(prize?.imageUrl || null);
  const [loading, setLoading]     = useState(false);
  const fileRef = useRef();
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.weight) { toast.error('Name and weight are required.'); return; }
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
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">{prize ? 'Edit Prize' : 'Add New Prize'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Preview + upload */}
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-2xl overflow-hidden cursor-pointer hover:border-orange-400 transition-colors h-32 flex items-center justify-center relative"
            style={{ backgroundColor: form.color + '18', borderColor: form.color + '60' }}>
            {preview
              ? <img src={preview} alt="" className="h-full object-contain" />
              : (
                <div className="text-center pointer-events-none">
                  <div className="text-3xl mb-1">🖼️</div>
                  <p className="text-gray-400 text-xs font-medium">Click to upload image (optional)</p>
                </div>
              )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setPreview(URL.createObjectURL(f)); } }} />

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Prize Name <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Free Drink"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Description</label>
            <input value={form.description} onChange={set('description')} placeholder="Short description..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                Weight <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1 text-xs">(higher = commoner)</span>
              </label>
              <input type="number" min="1" value={form.weight} onChange={set('weight')}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Wheel Color</label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 min-h-[44px]">
                <input type="color" value={form.color} onChange={set('color')} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" />
                <span className="text-sm text-gray-500 font-mono">{form.color}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              Stock Limit <span className="text-gray-400 font-normal text-xs">(empty = unlimited)</span>
            </label>
            <input type="number" min="0" value={form.stockRemaining} onChange={set('stockRemaining')} placeholder="Unlimited"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
          </div>

          <div className="flex items-center justify-between py-1 bg-gray-50 rounded-xl px-4">
            <div>
              <p className="text-sm font-semibold text-gray-700">Active on wheel</p>
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

// ── Main Admin Spin Page ──────────────────────────────────────────────────────
const AdminSpinPage = () => {
  const [prizes, setPrizes]           = useState([]);
  const [history, setHistory]         = useState([]);
  const [histTotal, setHistTotal]     = useState(0);
  const [config, setConfig]           = useState({ dailyLimit: 1 });
  const [loading, setLoading]         = useState(true);
  const [histLoading, setHistLoading] = useState(false);
  const [modal, setModal]             = useState(null);
  const [tab, setTab]                 = useState('prizes');
  const [savingConfig, setSavingConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRedeemed, setFilterRedeemed] = useState('all'); // 'all' | 'pending' | 'redeemed'
  const [histPage, setHistPage]       = useState(1);
  const HIST_LIMIT = 15;

  const fetchPrizesAndConfig = async () => {
    const [pRes, cRes] = await Promise.all([
      api.get('/admin/spin/prizes'),
      api.get('/spin/config'),
    ]);
    setPrizes(pRes.data.data.prizes);
    setConfig({ dailyLimit: cRes.data.data.dailyLimit });
  };

  const fetchHistory = async (page = 1, redeemed = 'all') => {
    setHistLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: HIST_LIMIT });
      if (redeemed !== 'all') params.set('redeemed', redeemed === 'redeemed' ? 'true' : 'false');
      const res = await api.get(`/admin/spin/history?${params}`);
      setHistory(res.data.data.history);
      setHistTotal(res.data.data.total);
    } catch { /* keep */ }
    finally { setHistLoading(false); }
  };

  useEffect(() => {
    const init = async () => {
      try { await fetchPrizesAndConfig(); await fetchHistory(); }
      catch { /* keep */ }
      finally { setLoading(false); }
    };
    init();
  }, []);

  useEffect(() => {
    if (tab === 'history') fetchHistory(histPage, filterRedeemed);
  }, [tab, histPage, filterRedeemed]);

  const handleRedeem = async (id) => {
    try {
      await api.patch(`/admin/spin/history/${id}/redeem`);
      setHistory((prev) => prev.map((h) => h.id === id ? { ...h, redeemed: true, redeemedAt: new Date().toISOString() } : h));
      toast.success('Marked as redeemed!');
    } catch (err) { toast.error(err.message); }
  };

  const handleDeletePrize = async (prize) => {
    if (!window.confirm(`Delete "${prize.name}"?\n\nIf it has spin history, deactivate it instead.`)) return;
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
      toast.success('Settings saved!');
    } catch (err) { toast.error(err.message); }
    finally { setSavingConfig(false); }
  };

  const activePrizes = prizes.filter((p) => p.isActive);
  const totalWeight  = activePrizes.reduce((s, p) => s + p.weight, 0);
  const totalSpins   = histTotal;
  const redeemedCount = history.filter((h) => h.redeemed).length;

  // Client-side search filter for history
  const filteredHistory = history.filter((h) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.user?.name?.toLowerCase().includes(q) ||
      h.user?.phone?.includes(q) ||
      h.prize?.name?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(histTotal / HIST_LIMIT);

  const TABS = [
    { key: 'prizes',  label: 'Prizes',       icon: Gift },
    { key: 'history', label: 'Spin History',  icon: Clock },
    { key: 'config',  label: 'Settings',      icon: Settings },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Spin & Win</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage prizes, view history and configure spins</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={async () => { setLoading(true); await fetchPrizesAndConfig(); setLoading(false); }}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center">
            <RefreshCw size={16} />
          </button>
          {tab === 'prizes' && (
            <Button variant="primary" size="sm" onClick={() => setModal('add')}>
              <Plus size={16} className="mr-1" /> Add Prize
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={Gift}   label="Total Prizes"    value={prizes.length}          sub={`${activePrizes.length} active`}       color="orange" />
            <StatCard icon={BarChart2} label="Total Spins"  value={totalSpins}             sub="all time"                              color="blue"   />
            <StatCard icon={CheckCircle} label="Redeemed"   value={history.filter(h=>h.redeemed).length} sub="on this page"          color="green"  />
            <StatCard icon={Users}  label="Daily Limit"     value={config.dailyLimit}      sub="spins / user / day"                    color="amber"  />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all min-h-[40px] ${tab === key ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* ── Prizes Tab ── */}
          {tab === 'prizes' && (
            <div className="space-y-4">
              {/* Wheel preview + summary */}
              {activePrizes.length > 0 && (
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
                  <WheelPreview prizes={activePrizes} />
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 mb-1">Live Wheel Preview</p>
                    <p className="text-xs text-gray-500 mb-3">This is how the wheel currently looks to customers.</p>
                    <div className="space-y-1.5">
                      {activePrizes.map((p) => {
                        const prob = totalWeight > 0 ? ((p.weight / totalWeight) * 100).toFixed(1) : 0;
                        return (
                          <div key={p.id} className="flex items-center gap-2 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                            <span className="text-gray-700 font-medium w-32 truncate">{p.name}</span>
                            <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${prob}%`, backgroundColor: p.color }} />
                            </div>
                            <span className="text-gray-500 font-mono w-10 text-right">{prob}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {prizes.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Gift size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No prizes yet. Add one to get started!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {prizes.map((p) => {
                    const prob = totalWeight > 0 ? ((p.weight / totalWeight) * 100).toFixed(1) : 0;
                    return (
                      <div key={p.id}
                        className={`bg-white rounded-2xl p-4 shadow-sm border-t-4 flex flex-col gap-3 transition-all ${!p.isActive ? 'opacity-50 grayscale' : ''}`}
                        style={{ borderTopColor: p.color }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                              style={{ backgroundColor: p.color + '22' }}>
                              {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-xl" /> : '🎁'}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5 leading-snug">{p.description || '—'}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => setModal(p)}
                              className="p-2 rounded-lg hover:bg-orange-50 text-orange-500 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDeletePrize(p)}
                              className="p-2 rounded-lg hover:bg-red-50 text-red-400 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Probability bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Win chance</span>
                            <span className="font-bold text-gray-800">{p.isActive ? `${prob}%` : 'Inactive'}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: p.isActive ? `${prob}%` : '0%', backgroundColor: p.color }} />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                          <span className="text-gray-500">
                            Weight: <strong className="text-gray-800">{p.weight}</strong>
                          </span>
                          <span className="text-gray-500">
                            Stock: <strong className="text-gray-800">{p.stockRemaining ?? '∞'}</strong>
                          </span>
                          <Badge variant={p.isActive ? 'success' : 'default'}>
                            {p.isActive ? 'Active' : 'Off'}
                          </Badge>
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
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search user or prize…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[42px]"
                  />
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                  {[
                    { key: 'all',      label: 'All'      },
                    { key: 'pending',  label: 'Pending'  },
                    { key: 'redeemed', label: 'Redeemed' },
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => { setFilterRedeemed(key); setHistPage(1); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[34px] ${filterRedeemed === key ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {histLoading ? (
                  <div className="flex justify-center py-10"><Spinner /></div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Clock size={36} className="mx-auto mb-3 text-gray-300" />
                    <p>No spins found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['Customer', 'Prize', 'Spun At', 'Status', 'Action'].map((h) => (
                            <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredHistory.map((h) => (
                          <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-gray-900">{h.user?.name}</p>
                              <p className="text-xs text-gray-400">{h.user?.phone || h.user?.email}</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: h.prize?.color || '#ccc' }} />
                                <span className="font-medium text-gray-900">{h.prize?.name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                              {new Date(h.spunAt).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-5 py-3.5">
                              <Badge variant={h.redeemed ? 'success' : 'warning'}>
                                {h.redeemed ? 'Redeemed' : 'Pending'}
                              </Badge>
                              {h.redeemed && h.redeemedAt && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {new Date(h.redeemedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              {!h.redeemed && (
                                <button onClick={() => handleRedeem(h.id)}
                                  className="flex items-center gap-1 text-xs text-white bg-green-500 hover:bg-green-600 font-semibold px-3 py-1.5 rounded-lg min-h-[32px] transition-colors">
                                  <CheckCircle size={12} /> Mark Redeemed
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Page {histPage} of {totalPages} · {histTotal} total</span>
                  <div className="flex gap-2">
                    <button onClick={() => setHistPage((p) => Math.max(1, p - 1))} disabled={histPage === 1}
                      className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors">
                      <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setHistPage((p) => Math.min(totalPages, p + 1))} disabled={histPage === totalPages}
                      className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Config Tab ── */}
          {tab === 'config' && (
            <div className="max-w-md">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <Settings size={18} className="text-orange-500" />
                  <h2 className="font-bold text-gray-900">Spin Settings</h2>
                </div>
                <div className="space-y-5">
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                    <label className="text-sm font-bold text-gray-800 block mb-0.5">Daily Spin Limit per User</label>
                    <p className="text-xs text-gray-500 mb-3">How many times each customer can spin per day</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setConfig((c) => ({ dailyLimit: Math.max(1, c.dailyLimit - 1) }))}
                        className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors">−</button>
                      <span className="text-3xl font-extrabold text-orange-600 w-12 text-center">{config.dailyLimit}</span>
                      <button onClick={() => setConfig((c) => ({ dailyLimit: Math.min(10, c.dailyLimit + 1) }))}
                        className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors">+</button>
                    </div>
                  </div>
                  <Button variant="primary" isLoading={savingConfig} onClick={saveConfig} fullWidth>
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {modal && (
        <PrizeModal
          prize={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchPrizesAndConfig(); }}
        />
      )}
    </div>
  );
};

export default AdminSpinPage;
