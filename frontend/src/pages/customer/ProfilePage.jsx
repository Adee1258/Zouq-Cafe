import { useState, useEffect } from 'react';
import {
  User, MapPin, Phone, Mail, LogOut, Lock,
  Eye, EyeOff, ChevronRight, ShieldCheck, Package, Heart, ShoppingCart, Flame, Gift, Trophy, Clock, Star,
} from 'lucide-react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../stores/authStore';
import useFavoritesStore from '../../stores/favoritesStore';
import useCartStore from '../../stores/cartStore';
import api from '../../lib/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'profile',   label: 'Profile',   icon: User },
  { id: 'loyalty',   label: 'Points',    icon: Trophy },
  { id: 'rewards',   label: 'Rewards',   icon: Gift },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'security',  label: 'Security',  icon: ShieldCheck },
];

// ── Profile Tab ───────────────────────────────────────────────────────────────
const ProfileTab = ({ user, fetchMe }) => {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (form.name.trim().length < 2) {
      toast.error('Name must be at least 2 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.patch('/auth/me', {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      });
      await fetchMe();
      toast.success('Profile updated ✅');
      setEditing(false);
    } catch (err) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setForm({
      name: user?.name || '',
      phone: user?.phone || '',
      address: user?.address || '',
    });
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* Avatar + name card */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center text-white text-2xl font-extrabold flex-shrink-0 shadow-md select-none">
            {user.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-600 mt-1">
              {user.role === 'ADMIN' ? '👑 Admin' : '🛒 Customer'}
            </span>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Full name"
              icon={User}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Your full name"
              autoComplete="name"
            />
            <Input
              label="Phone number"
              icon={Phone}
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="03001234567"
              autoComplete="tel"
            />
            <Input
              label="Delivery address"
              icon={MapPin}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="House #, Street, City"
              autoComplete="street-address"
            />
            <p className="text-xs text-gray-400">
              * Email address cannot be changed after signup.
            </p>
            <div className="flex gap-3 pt-2">
              <Button type="submit" variant="primary" isLoading={loading} className="flex-1">
                Save Changes
              </Button>
              <Button type="button" variant="ghost" onClick={handleCancel} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-1">
            {[
              { icon: User,   label: 'Name',    value: user.name },
              { icon: Mail,   label: 'Email',   value: user.email },
              { icon: Phone,  label: 'Phone',   value: user.phone },
              { icon: MapPin, label: 'Address', value: user.address },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
                <Icon size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm text-gray-700 break-words">
                    {value || <span className="text-gray-300 italic">Not set</span>}
                  </p>
                </div>
              </div>
            ))}
            <div className="pt-4">
              <Button variant="outline" fullWidth onClick={() => setEditing(true)}>
                Edit Profile
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <Link
          to="/orders"
          className="flex items-center justify-between px-5 py-4 hover:bg-orange-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Package size={18} className="text-orange-400" />
            <span className="text-sm font-medium text-gray-700">My Orders</span>
          </div>
          <ChevronRight size={16} className="text-gray-400" />
        </Link>
      </div>
    </div>
  );
};

// ── Loyalty Points Tab ────────────────────────────────────────────────────────
const LoyaltyTab = () => {
  const [data,    setData]    = useState(null);   // { pointsBalance, redeemValue, monetaryValue }
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/loyalty/balance'),
      api.get('/loyalty/history?limit=30'),
    ])
      .then(([balRes, histRes]) => {
        setData(balRes.data.data);
        setHistory(histRes.data.data.transactions || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-[3px] border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const typeLabel = { EARN: 'Earned', REDEEM: 'Redeemed', REVOKE: 'Revoked', MANUAL: 'Adjusted' };
  const typeColor = { EARN: 'text-green-600', REDEEM: 'text-amber-600', REVOKE: 'text-red-500', MANUAL: 'text-blue-500' };
  const typeBg    = { EARN: 'bg-green-50',   REDEEM: 'bg-amber-50',    REVOKE: 'bg-red-50',    MANUAL: 'bg-blue-50'   };

  return (
    <div className="space-y-4">

      {/* Balance card */}
      <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={18} className="text-white/80" />
          <span className="text-sm font-semibold text-white/80">Loyalty Points</span>
        </div>
        <p className="text-5xl font-extrabold tracking-tight">
          {data?.pointsBalance?.toLocaleString() || 0}
          <span className="text-2xl font-semibold ml-2 text-white/70">pts</span>
        </p>
        <p className="text-sm text-white/80 mt-2">
          = Rs. {(data?.monetaryValue || 0).toLocaleString()} discount value
        </p>
        <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-white/70">
          <span>1 point = Rs. {data?.redeemValue || 1}</span>
          <span>Points never expire 🎉</span>
        </div>
      </div>

      {/* How to earn */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Star size={14} className="text-amber-500" /> How it works
        </p>
        <div className="space-y-2">
          {[
            { emoji: '🛒', text: 'Place an order and get it delivered' },
            { emoji: '⭐', text: 'Earn loyalty points automatically' },
            { emoji: '💸', text: 'Redeem points for discounts at checkout' },
          ].map(({ emoji, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-gray-600">
              <span className="text-lg w-7 text-center">{emoji}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Clock size={14} className="text-gray-400" /> Transaction History
          </p>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Trophy size={32} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm">No transactions yet</p>
            <p className="text-xs mt-1">Place your first order to earn points!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {history.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${typeBg[tx.type]}`}>
                  <span className="text-base">
                    {tx.type === 'EARN' ? '⭐' : tx.type === 'REDEEM' ? '🎁' : tx.type === 'REVOKE' ? '↩️' : '✏️'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${typeColor[tx.type]}`}>{typeLabel[tx.type]}</p>
                  <p className="text-xs text-gray-400 truncate">{tx.note || (tx.orderId ? `Order #${tx.orderId}` : '—')}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${tx.points >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.points >= 0 ? '+' : ''}{tx.points} pts
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(tx.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Rewards Tab ───────────────────────────────────────────────────────────────
const RewardsTab = () => {
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [using, setUsing]       = useState(null); // id of voucher being used
  const [showModal, setShowModal] = useState(null); // voucher to confirm use

  useEffect(() => {
    api.get('/spin/history?limit=50')
      .then((r) => setHistory(r.data.data.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pending   = history.filter((h) => !h.redeemed);
  const redeemed  = history.filter((h) => h.redeemed);

  const handleUse = async (record) => {
    setUsing(record.id);
    try {
      await api.post(`/spin/history/${record.id}/use`);
      setHistory((prev) =>
        prev.map((h) =>
          h.id === record.id
            ? { ...h, redeemed: true, redeemedAt: new Date().toISOString() }
            : h
        )
      );
      toast.success('Reward used! Show this confirmation to our staff 🎉');
      setShowModal(null);
    } catch (err) {
      toast.error(err.message || 'Failed to use reward.');
    } finally {
      setUsing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
        <div className="text-5xl mb-3">🎡</div>
        <p className="font-semibold text-gray-700">No rewards yet</p>
        <p className="text-xs text-gray-400 mt-1 mb-5">Spin the wheel to win exciting prizes!</p>
        <Link
          to="/spin"
          className="inline-flex items-center gap-2 bg-orange-500 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-orange-600 transition-colors text-sm"
        >
          <Gift size={16} /> Go Spin
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Won',  value: history.length,  color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Pending',    value: pending.length,   color: 'text-amber-600',  bg: 'bg-amber-50'  },
          { label: 'Used',       value: redeemed.length,  color: 'text-green-600',  bg: 'bg-green-50'  },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
            <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Pending vouchers */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <Trophy size={15} className="text-amber-500" /> Available to Use ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map((h) => (
              <VoucherCard
                key={h.id}
                record={h}
                onUse={() => setShowModal(h)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Used vouchers */}
      {redeemed.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-500 mb-2 flex items-center gap-2">
            <Clock size={15} /> Used Rewards ({redeemed.length})
          </h3>
          <div className="space-y-2">
            {redeemed.map((h) => (
              <VoucherCard key={h.id} record={h} used />
            ))}
          </div>
        </div>
      )}

      {/* Confirm use modal */}
      {showModal && (
        <UseConfirmModal
          record={showModal}
          loading={using === showModal.id}
          onConfirm={() => handleUse(showModal)}
          onClose={() => setShowModal(null)}
        />
      )}
    </div>
  );
};

// ── Voucher Card ──────────────────────────────────────────────────────────────
const VoucherCard = ({ record, onUse, used = false }) => {
  const prize = record.prize;
  const color = prize?.color || '#F97316';

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all ${used ? 'opacity-60' : 'hover:shadow-md'}`}
    >
      {/* Top colored strip */}
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

      <div className="p-4">
        <div className="flex items-center gap-3">
          {/* Prize icon */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
            style={{ backgroundColor: color + '22' }}
          >
            {prize?.imageUrl
              ? <img src={prize.imageUrl} alt="" className="w-full h-full object-cover rounded-xl" />
              : '🎁'}
          </div>

          {/* Prize info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-sm">{prize?.name || 'Prize'}</p>
            {prize?.description && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{prize.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Clock size={10} />
              Won on {new Date(record.spunAt).toLocaleDateString('en-PK', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          </div>

          {/* Status / Action */}
          <div className="flex-shrink-0 text-right">
            {used ? (
              <div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-100 px-2.5 py-1 rounded-full">
                  ✓ Used
                </span>
                {record.redeemedAt && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(record.redeemedAt).toLocaleDateString('en-PK', {
                      day: 'numeric', month: 'short',
                    })}
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={onUse}
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
              >
                Use Now
              </button>
            )}
          </div>
        </div>

        {/* Voucher code strip — only for pending */}
        {!used && (
          <div
            className="mt-3 rounded-xl px-3 py-2 flex items-center justify-between"
            style={{ backgroundColor: color + '15', border: `1px dashed ${color}88` }}
          >
            <span className="text-xs text-gray-500">Voucher ID</span>
            <span className="text-xs font-mono font-bold tracking-widest" style={{ color }}>
              ZC-SPIN-{String(record.id).padStart(5, '0')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Use Confirm Modal ─────────────────────────────────────────────────────────
const UseConfirmModal = ({ record, loading, onConfirm, onClose }) => {
  const prize = record.prize;
  const color = prize?.color || '#F97316';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 text-center">
        <div
          className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
          style={{ backgroundColor: color + '22' }}
        >
          {prize?.imageUrl
            ? <img src={prize.imageUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
            : '🎁'}
        </div>

        <h2 className="text-lg font-extrabold text-gray-900 mb-1">Use this reward?</h2>
        <p className="font-semibold mb-1" style={{ color }}>{prize?.name}</p>
        {prize?.description && (
          <p className="text-sm text-gray-500 mb-3">{prize.description}</p>
        )}

        <div
          className="rounded-xl px-4 py-2.5 mb-5 text-center"
          style={{ backgroundColor: color + '15' }}
        >
          <p className="text-xs text-gray-500 mb-0.5">Voucher ID</p>
          <p className="font-mono font-bold tracking-widest text-sm" style={{ color }}>
            ZC-SPIN-{String(record.id).padStart(5, '0')}
          </p>
        </div>

        <p className="text-xs text-gray-400 mb-5">
          Once used, this reward cannot be claimed again. Make sure staff is present before confirming.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-xl text-white font-bold text-sm transition-colors disabled:opacity-60"
            style={{ backgroundColor: color }}
          >
            {loading ? 'Using...' : 'Confirm Use'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Favorites Tab ─────────────────────────────────────────────────────────────
const FavoritesTab = () => {
  const favorites      = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const addItem        = useCartStore((s) => s.addItem);

  if (favorites.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
        <Heart size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">No favorites yet</p>
        <p className="text-xs text-gray-400 mt-1 mb-4">Tap the ❤ icon on any food or deal to save it here.</p>
        <Link to="/menu" className="inline-flex items-center gap-1.5 bg-orange-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-orange-600 transition-colors">
          Browse Menu
        </Link>
      </div>
    );
  }

  const products = favorites.filter((f) => f.type === 'product');
  const deals    = favorites.filter((f) => f.type === 'deal');

  return (
    <div className="space-y-4">
      {products.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <ShoppingCart size={14} className="text-orange-400" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Food Items ({products.length})</p>
          </div>
          {products.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-t border-gray-50">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-orange-50 flex-shrink-0">
                {item.imageUrl
                  ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-orange-500 font-bold">Rs. {Number(item.price).toLocaleString()}</p>
              </div>
              <button
                onClick={() => { addItem({ id: item.id, name: item.name, price: item.price, imageUrl: item.imageUrl }); toast.success('Added to cart!'); }}
                style={{ minHeight: 'unset', minWidth: 'unset' }}
                className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => toggleFavorite(item)}
                style={{ minHeight: 'unset', minWidth: 'unset' }}
                className="p-1.5 text-red-400 hover:text-red-500 transition-colors"
                aria-label="Remove from favorites"
              >
                <Heart size={16} className="fill-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {deals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <Flame size={14} className="text-red-400" />
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Hot Deals ({deals.length})</p>
          </div>
          {deals.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-t border-gray-50">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-orange-50 flex-shrink-0">
                {item.imageUrl
                  ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-xl">🔥</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-orange-500 font-bold">Rs. {Number(item.dealPrice).toLocaleString()}</p>
              </div>
              <Link
                to="/deals"
                style={{ minHeight: 'unset', minWidth: 'unset' }}
                className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors"
              >
                View
              </Link>
              <button
                onClick={() => toggleFavorite(item)}
                style={{ minHeight: 'unset', minWidth: 'unset' }}
                className="p-1.5 text-red-400 hover:text-red-500 transition-colors"
                aria-label="Remove from favorites"
              >
                <Heart size={16} className="fill-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
const SecurityTab = () => {
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.currentPassword) e.currentPassword = 'Current password is required.';
    if (!form.newPassword) {
      e.newPassword = 'New password is required.';
    } else if (form.newPassword.length < 6) {
      e.newPassword = 'Password must be at least 6 characters.';
    }
    if (!form.confirmPassword) {
      e.confirmPassword = 'Please confirm your new password.';
    } else if (form.newPassword !== form.confirmPassword) {
      e.confirmPassword = 'Passwords do not match.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await api.patch('/auth/me/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully 🔒');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setErrors({});
    } catch (err) {
      const msg = err.message || 'Failed to change password.';
      if (msg.toLowerCase().includes('current') || msg.toLowerCase().includes('incorrect')) {
        setErrors((prev) => ({ ...prev, currentPassword: msg }));
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const PasswordField = ({ label, field, show, onToggle, placeholder, autoComplete }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={form[field]}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, [field]: e.target.value }));
            if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
          }}
          autoComplete={autoComplete}
          className={`w-full rounded-xl border bg-white pl-10 pr-11 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all min-h-[44px] ${errors[field] ? 'border-red-400' : 'border-gray-200'}`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {errors[field] && <p className="text-xs text-red-500">⚠ {errors[field]}</p>}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
          <Lock size={18} className="text-orange-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Change Password</h3>
          <p className="text-xs text-gray-400">Keep your account secure</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <PasswordField
          label="Current password"
          field="currentPassword"
          show={showCurrent}
          onToggle={() => setShowCurrent(!showCurrent)}
          placeholder="Your current password"
          autoComplete="current-password"
        />
        <PasswordField
          label="New password"
          field="newPassword"
          show={showNew}
          onToggle={() => setShowNew(!showNew)}
          placeholder="Min. 6 characters"
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm new password"
          field="confirmPassword"
          show={showConfirm}
          onToggle={() => setShowConfirm(!showConfirm)}
          placeholder="Repeat new password"
          autoComplete="new-password"
        />
        <Button type="submit" variant="primary" fullWidth isLoading={loading} className="mt-2">
          Update Password
        </Button>
      </form>
    </div>
  );
};

// ── Main ProfilePage ──────────────────────────────────────────────────────────
const ProfilePage = () => {
  const { user, fetchMe } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  // Safety guard — agar customer store mein ADMIN user aa gaya toh ProtectedRoute
  // already redirect kar deta hai. Ye extra check sirf edge case ke liye hai
  // (e.g. store hydration race on first paint).
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-24 md:pb-8 space-y-4">
      {/* Page title */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your profile and settings</p>
      </div>

      {/* Tabs — scrollable on small screens */}
      <div className="flex bg-gray-100 rounded-xl p-1 overflow-x-auto gap-1 scrollbar-none">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === id
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'profile'   && <ProfileTab user={user} fetchMe={fetchMe} />}
      {activeTab === 'loyalty'   && <LoyaltyTab />}
      {activeTab === 'rewards'   && <RewardsTab />}
      {activeTab === 'favorites' && <FavoritesTab />}
      {activeTab === 'security'  && <SecurityTab />}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white rounded-2xl shadow-sm text-red-500 hover:bg-red-50 font-semibold text-sm transition-colors min-h-[44px]"
      >
        <LogOut size={16} /> Logout
      </button>
    </div>
  );
};

export default ProfilePage;
