import { useState, useEffect, useRef } from 'react';
import {
  Plus, X, Pencil, Trash2, Trophy, Users,
  RefreshCw, ChevronDown, ChevronUp, Sparkles,
  BadgeCheck, AlertCircle, Gift, Image as ImageIcon, Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtFull = (d) =>
  new Date(d).toLocaleString('en-PK', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const drawStatus = (draw) => {
  if (draw.drawnAt)   return { label: 'Drawn',    variant: 'success' };
  if (!draw.isActive) return { label: 'Inactive', variant: 'default' };
  return               { label: 'Active',   variant: 'primary'  };
};

// ── Create / Edit Modal ───────────────────────────────────────────────────────
const DrawModal = ({ draw, onClose, onSaved }) => {
  const isEdit = Boolean(draw);
  const [form, setForm] = useState({
    title:          draw?.title          || 'Lucky Draw',
    description:    draw?.description    || '',
    minSpendAmount: draw?.minSpendAmount != null ? String(draw.minSpendAmount) : '',
    maxEntries:     draw?.maxEntries     != null ? String(draw.maxEntries)     : '100',
    isActive:       draw?.isActive  ?? true,
  });
  const [bannerFile, setBannerFile] = useState(null);
  const [preview,    setPreview]    = useState(draw?.bannerUrl || null);
  const [loading,    setLoading]    = useState(false);
  const fileRef = useRef();
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.minSpendAmount || Number(form.minSpendAmount) <= 0) {
      toast.error('Minimum spend amount required.'); return;
    }
    if (!form.maxEntries || Number(form.maxEntries) < 1) {
      toast.error('Draw entries target required.'); return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('title',          form.title.trim());
      fd.append('description',    form.description.trim());
      fd.append('minSpendAmount', form.minSpendAmount);
      fd.append('maxEntries',     form.maxEntries);
      fd.append('isActive',       String(form.isActive));
      if (bannerFile) fd.append('banner', bannerFile);

      if (isEdit) {
        await api.patch(`/lucky-draw/${draw.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Draw updated!');
      } else {
        await api.post('/lucky-draw', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Lucky Draw created!');
      }
      onSaved();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">{isEdit ? 'Edit Lucky Draw' : 'New Lucky Draw'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Banner Upload */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">
              Banner Image <span className="text-gray-400 font-normal">(16:9 recommended)</span>
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className="relative w-full cursor-pointer rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 hover:border-orange-400 transition-colors bg-gray-50 group"
              style={{ aspectRatio: '16/9' }}
            >
              {preview ? (
                <>
                  <img src={preview} alt="banner" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white/90 rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <ImageIcon size={16} /> Change Banner
                    </div>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                  <ImageIcon size={32} className="text-gray-300" />
                  <p className="text-sm font-medium">Click to upload banner</p>
                  <p className="text-xs text-gray-300">Recommended: 1280 × 720px (16:9)</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setBannerFile(f); setPreview(URL.createObjectURL(f)); }
              }} />
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Draw Title</label>
            <input value={form.title} onChange={set('title')} placeholder="Lucky Draw"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={3}
              placeholder="e.g. Spend Rs. 1000 and get a chance to win exciting prizes!"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>

          {/* Min spend + Max entries */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Min. Spend <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-1.5">Qualify karne ke liye</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">Rs.</span>
                <input type="number" min="1" value={form.minSpendAmount} onChange={set('minSpendAmount')}
                  placeholder="1000"
                  className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Draw Target <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-1.5">Kitne unique users pe draw</p>
              <div className="relative">
                <Target size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="number" min="1" value={form.maxEntries} onChange={set('maxEntries')}
                  placeholder="100"
                  className="w-full rounded-xl border border-gray-200 pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
              </div>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2 bg-gray-50 rounded-xl px-4">
            <div>
              <p className="text-sm font-semibold text-gray-700">Active</p>
              <p className="text-xs text-gray-400">Customers ko visible hoga</p>
            </div>
            <div
              onClick={() => setForm((p) => ({ ...p, isActive: !p.isActive }))}
              style={{
                width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                backgroundColor: form.isActive ? '#f97316' : '#d1d5db',
                position: 'relative', transition: 'background-color 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', backgroundColor: '#fff',
                position: 'absolute', top: 3,
                left: form.isActive ? 23 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" isLoading={loading} className="flex-1">
              {isEdit ? 'Save Changes' : 'Create Draw'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Winner Picker Modal ───────────────────────────────────────────────────────
const PickWinnerModal = ({ draw, onClose, onWon }) => {
  const [prize,   setPrize]   = useState('');
  const [loading, setLoading] = useState(false);
  const [winner,  setWinner]  = useState(null);

  const handleDraw = async () => {
    if (!prize.trim()) { toast.error('Prize description likhein.'); return; }
    setLoading(true);
    try {
      const res = await api.post(`/lucky-draw/${draw.id}/draw`, { prize: prize.trim() });
      setWinner(res.data.data.winner);
      toast.success('Winner pick ho gaya!');
      onWon();
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!winner ? onClose : undefined} />
      <div className="relative bg-white rounded-3xl shadow-2xl p-7 max-w-sm w-full text-center"
        style={{ animation: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <style>{`@keyframes popIn{from{transform:scale(0.7);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

        {winner ? (
          <>
            <div className="text-6xl mb-3 animate-bounce">🎉</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">Winner!</h2>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 mb-5">
              <p className="text-2xl font-extrabold text-orange-600">{winner.user?.name}</p>
              <p className="text-sm text-gray-500 mt-1">{winner.user?.phone || winner.user?.email}</p>
              <div className="mt-3 bg-white rounded-xl px-3 py-2">
                <p className="text-xs text-gray-400">Prize</p>
                <p className="font-bold text-gray-800">{winner.prize}</p>
              </div>
            </div>
            <Button variant="primary" fullWidth onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trophy size={28} className="text-orange-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Lucky Draw — Pick Winner</h2>
            <p className="text-sm text-gray-500 mb-5">
              <strong className="text-orange-600">{draw._count?.entries || 0}</strong> eligible entries mein se random winner pick hoga
            </p>
            <div className="mb-4">
              <label className="text-sm font-semibold text-gray-700 block mb-1.5 text-left">Prize <span className="text-red-500">*</span></label>
              <input value={prize} onChange={(e) => setPrize(e.target.value)}
                placeholder="e.g. Free lunch for 2, Gift voucher..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-h-[44px]" />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
              <Button variant="primary" isLoading={loading} onClick={handleDraw} className="flex-1">
                <Sparkles size={15} className="mr-1" /> Draw Now!
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Draw Card ─────────────────────────────────────────────────────────────────
const DrawCard = ({ draw, onEdit, onDelete, onPickWinner }) => {
  const [expanded, setExpanded] = useState(false);
  const [entries,  setEntries]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const status     = drawStatus(draw);
  const isLive     = draw.isActive && !draw.drawnAt;
  const entryCount = draw._count?.entries || 0;
  const maxEntries = draw.maxEntries || 100;
  const pct        = Math.min(100, Math.round((entryCount / maxEntries) * 100));
  const canDraw    = isLive && entryCount > 0;

  const loadEntries = async () => {
    if (entries) { setExpanded((v) => !v); return; }
    setLoading(true);
    try {
      const res = await api.get(`/lucky-draw/${draw.id}`);
      setEntries(res.data.data.draw.entries);
      setExpanded(true);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleDelete = () => {
    if (!window.confirm(`"${draw.title}" delete karo? Sari entries bhi hata di jayengi.`)) return;
    onDelete(draw.id);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
      {/* Banner */}
      {draw.bannerUrl ? (
        <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
          <img src={draw.bannerUrl} alt={draw.title} className="w-full h-full object-cover" />
          <div className="absolute top-3 left-3"><Badge variant={status.variant}>{status.label}</Badge></div>
          <div className="absolute top-3 right-3 flex gap-1">
            <button onClick={() => onEdit(draw)}
              className="p-2 rounded-xl bg-white/90 hover:bg-white text-orange-500 shadow min-h-[36px] min-w-[36px] flex items-center justify-center">
              <Pencil size={14} />
            </button>
            <button onClick={handleDelete}
              className="p-2 rounded-xl bg-white/90 hover:bg-white text-red-400 shadow min-h-[36px] min-w-[36px] flex items-center justify-center">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <p className="font-extrabold text-white text-lg leading-tight drop-shadow">{draw.title}</p>
          </div>
        </div>
      ) : (
        <div className={`h-2 w-full ${isLive ? 'bg-gradient-to-r from-orange-400 to-amber-400' : 'bg-gray-200'}`} />
      )}

      <div className="p-5">
        {!draw.bannerUrl && (
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-extrabold text-gray-900 text-lg">{draw.title}</h3>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button onClick={() => onEdit(draw)}
                className="p-2 rounded-xl hover:bg-orange-50 text-orange-500 min-h-[36px] min-w-[36px] flex items-center justify-center">
                <Pencil size={15} />
              </button>
              <button onClick={handleDelete}
                className="p-2 rounded-xl hover:bg-red-50 text-red-400 min-h-[36px] min-w-[36px] flex items-center justify-center">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        )}

        {draw.description && (
          <p className="text-sm text-gray-600 leading-relaxed mb-4 bg-gray-50 rounded-xl px-4 py-3">{draw.description}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-orange-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-0.5">Min. Spend</p>
            <p className="font-extrabold text-orange-600 text-sm">Rs. {Number(draw.minSpendAmount).toLocaleString()}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-0.5">Entries</p>
            <p className="font-extrabold text-blue-600 text-lg">{entryCount} / {maxEntries}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-0.5">Winners</p>
            <p className="font-extrabold text-green-600 text-lg">{draw._count?.winners ?? draw.winners?.length ?? 0}</p>
          </div>
        </div>

        {/* Entry progress bar */}
        {isLive && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span className="font-medium">Users qualified</span>
              <span className={`font-bold ${pct >= 100 ? 'text-green-600' : 'text-orange-500'}`}>{pct}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-orange-400 to-amber-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {pct >= 100 ? (
              <p className="text-xs text-green-600 font-semibold mt-1.5">✅ Target reached! Draw karo ab.</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1.5">{maxEntries - entryCount} more unique users needed to trigger draw</p>
            )}
          </div>
        )}

        {/* Winner */}
        {draw.winners?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <Trophy size={18} className="text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-amber-600 font-semibold">Winner</p>
              <p className="font-bold text-gray-900">{draw.winners[0].user?.name}</p>
              <p className="text-xs text-gray-500">{draw.winners[0].prize}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {canDraw && (
            <Button variant="primary" size="sm" onClick={() => onPickWinner(draw)}>
              <Sparkles size={14} className="mr-1" /> Pick Winner
            </Button>
          )}
          <button onClick={loadEntries} disabled={loading}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-600 font-medium px-3 py-2 rounded-xl hover:bg-orange-50 transition-colors min-h-[36px] disabled:opacity-50">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Hide Entries' : 'Show Entries'}
          </button>
        </div>
      </div>

      {expanded && entries && (
        <div className="border-t border-gray-100">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No qualified entries yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['#', 'Customer', 'Contact', 'Total Spent', 'Qualified On'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {entries.map((e, i) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{e.user?.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.user?.phone || e.user?.email}</td>
                      <td className="px-4 py-3 font-bold text-orange-600">Rs. {Number(e.totalSpent).toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtFull(e.qualifiedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Admin Lucky Draw Page ────────────────────────────────────────────────
const AdminLuckyDrawPage = () => {
  const [draws,   setDraws]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | 'create' | draw-object
  const [pickFor, setPickFor] = useState(null); // draw object for winner modal

  const fetchDraws = async () => {
    try {
      const res = await api.get('/lucky-draw');
      setDraws(res.data.data.draws);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDraws(); }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/lucky-draw/${id}`);
      setDraws((prev) => prev.filter((d) => d.id !== id));
      toast.success('Draw deleted.');
    } catch (err) { toast.error(err.message); }
  };

  const activeCount   = draws.filter((d) => d.isActive && !d.drawnAt).length;
  const totalEntries  = draws.reduce((s, d) => s + (d._count?.entries || 0), 0);
  const totalWinners  = draws.reduce((s, d) => s + (d.winners?.length || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            🎟️ Lucky Draw
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage lucky draws — entries auto add on order delivery</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchDraws}
            className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={16} />
          </button>
          <Button variant="primary" size="sm" onClick={() => setModal('create')}>
            <Plus size={16} className="mr-1" /> New Draw
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Gift,        label: 'Total Draws',   value: draws.length,   color: 'orange' },
            { icon: BadgeCheck,  label: 'Active Draws',  value: activeCount,    color: 'green'  },
            { icon: Users,       label: 'Total Entries', value: totalEntries,   color: 'blue'   },
            { icon: Trophy,      label: 'Winners Drawn', value: totalWinners,   color: 'amber'  },
          ].map(({ icon: Icon, label, value, color }) => {
            const cls = {
              orange: 'bg-orange-50 text-orange-600',
              green:  'bg-green-50  text-green-600',
              blue:   'bg-blue-50   text-blue-600',
              amber:  'bg-amber-50  text-amber-600',
            };
            return (
              <div key={label} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 border border-gray-100">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cls[color]}`}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-gray-900 leading-none">{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* How it works banner */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-2xl px-5 py-4 flex gap-3">
        <AlertCircle size={18} className="text-orange-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 space-y-0.5">
          <p className="font-semibold text-gray-800">Kaise kaam karta hai?</p>
          <p>1. New draw banao — minimum spend amount aur draw target (e.g. 100 users) set karo.</p>
          <p>2. Jab bhi koi customer ka order <strong>Delivered</strong> hota hai, us ka name automatically entry list mein add hota hai.</p>
          <p>3. Ek user dobara order kare to uska name <strong>dobara add nahi hoga</strong> — sirf unique users count hote hain.</p>
          <p>4. Jab target pura ho jaye to <strong>"Pick Winner"</strong> pe click karo — random winner pick hoga.</p>
        </div>
      </div>

      {/* Draws list */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : draws.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Gift size={44} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Koi draw nahi hai abhi. "New Draw" se banao!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {draws.map((d) => (
            <DrawCard
              key={d.id}
              draw={d}
              onEdit={(draw) => setModal(draw)}
              onDelete={handleDelete}
              onPickWinner={(draw) => setPickFor(draw)}
              onRefresh={fetchDraws}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <DrawModal
          draw={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchDraws(); }}
        />
      )}
      {pickFor && (
        <PickWinnerModal
          draw={pickFor}
          onClose={() => setPickFor(null)}
          onWon={fetchDraws}
        />
      )}
    </div>
  );
};

export default AdminLuckyDrawPage;
