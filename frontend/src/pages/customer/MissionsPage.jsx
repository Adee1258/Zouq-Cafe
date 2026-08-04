import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Target, Gift, Lock, CheckCircle, Clock, ShoppingBag,
  Star, Copy, ChevronRight, Ticket, Trophy, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import useAuthStore from '../../stores/authStore';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import useSEO from '../../hooks/useSEO';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const pct = (progress, target) => Math.min(100, Math.round((progress / target) * 100));

// Countdown to next Monday 00:00 UTC (= 5 AM PKT)
const useResetCountdown = () => {
  const getMs = () => {
    const now = new Date();
    const d   = new Date(now);
    const day = d.getUTCDay();
    const daysUntilMon = day === 0 ? 1 : 8 - day; // days until next Monday
    d.setUTCDate(d.getUTCDate() + daysUntilMon);
    d.setUTCHours(0, 0, 0, 0);
    return Math.max(0, d - now);
  };

  const calc = () => {
    const ms = getMs();
    if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const days    = Math.floor(ms / 86400000);
    const hours   = Math.floor((ms % 86400000) / 3600000);
    const minutes = Math.floor((ms % 3600000)  / 60000);
    const seconds = Math.floor((ms % 60000)    / 1000);
    return { days, hours, minutes, seconds };
  };

  const [time, setTime] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
};

// ── Sub-components ────────────────────────────────────────────────────────────
const MissionTypeBadge = ({ type }) => (
  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
    type === 'DEALS_BOUGHT'
      ? 'bg-purple-100 text-purple-600'
      : 'bg-blue-100 text-blue-600'
  }`}>
    {type === 'DEALS_BOUGHT' ? '🎁 Deals' : '🛒 Items'}
  </span>
);

const ProgressBar = ({ progress, target, completed }) => {
  const p = pct(progress, target);
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5 text-xs">
        <span className="text-gray-500 font-medium">
          {progress} / {target} {target === 1 ? 'unit' : 'units'}
        </span>
        <span className={`font-bold ${completed ? 'text-green-600' : 'text-orange-500'}`}>
          {p}%
        </span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            completed
              ? 'bg-gradient-to-r from-green-400 to-emerald-500'
              : 'bg-gradient-to-r from-orange-400 to-amber-400'
          }`}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
};

const VoucherCard = ({ voucher, missionTitle }) => {
  const expired = new Date(voucher.expiresAt) < new Date();

  const copyCode = () => {
    navigator.clipboard.writeText(voucher.code)
      .then(() => toast.success(`Code copied: ${voucher.code}`))
      .catch(() => toast.error('Failed to copy'));
  };

  return (
    <div className={`rounded-2xl border-2 p-4 ${
      voucher.redeemed
        ? 'bg-gray-50 border-gray-200 opacity-70'
        : expired
        ? 'bg-red-50 border-red-200 opacity-80'
        : 'bg-gradient-to-br from-amber-50 to-orange-50 border-orange-300'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Ticket size={16} className={voucher.redeemed || expired ? 'text-gray-400' : 'text-orange-500'} />
          <span className="text-xs font-semibold text-gray-600 truncate max-w-[140px]">{missionTitle}</span>
        </div>
        {voucher.redeemed ? (
          <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Used</span>
        ) : expired ? (
          <span className="text-[10px] font-bold bg-red-100 text-red-500 px-2 py-0.5 rounded-full">Expired</span>
        ) : (
          <span className="text-[10px] font-bold bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Active</span>
        )}
      </div>

      <p className="text-2xl font-extrabold text-orange-600 mb-0.5">Rs. {voucher.amount} OFF</p>
      <p className="text-xs text-gray-500 mb-3">Min. order Rs. {voucher.minOrder.toLocaleString()}</p>

      {/* Code row */}
      <button
        onClick={!voucher.redeemed && !expired ? copyCode : undefined}
        disabled={voucher.redeemed || expired}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-mono text-sm font-bold tracking-widest transition-colors ${
          voucher.redeemed || expired
            ? 'bg-gray-200 text-gray-400 cursor-default'
            : 'bg-white border-2 border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 active:scale-[0.98]'
        }`}
      >
        <span>{voucher.code}</span>
        {!voucher.redeemed && !expired && <Copy size={14} className="text-orange-400 flex-shrink-0" />}
      </button>

      <p className="text-[10px] text-gray-400 mt-2 text-center">
        {voucher.redeemed
          ? `Used on ${fmtDate(voucher.redeemedAt)}`
          : `Expires ${fmtDate(voucher.expiresAt)}`}
      </p>
    </div>
  );
};

const MissionCard = ({ mission }) => {
  const { progress, completed, voucher } = mission;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all ${
      completed ? 'border-green-300' : 'border-transparent'
    }`}>
      {/* Header */}
      <div className={`px-4 pt-4 pb-3 ${completed ? 'bg-green-50' : ''}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-bold text-gray-900">{mission.title}</h3>
              <MissionTypeBadge type={mission.type} />
            </div>
            {mission.description && (
              <p className="text-xs text-gray-500 leading-snug">{mission.description}</p>
            )}
          </div>
          {completed ? (
            <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle size={20} className="text-white" />
            </div>
          ) : (
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Target size={18} className="text-orange-500" />
            </div>
          )}
        </div>

        {/* Reward pill */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
            <Gift size={11} /> Rs. {mission.voucherAmount} voucher
          </span>
          <span className="text-xs text-gray-400">on orders ≥ Rs. {mission.minOrderForVoucher.toLocaleString()}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 pb-3">
        <ProgressBar progress={progress} target={mission.targetCount} completed={completed} />
        {!completed && (
          <p className="text-xs text-gray-400 mt-2">
            {mission.targetCount - progress > 0
              ? `${mission.targetCount - progress} more ${mission.type === 'DEALS_BOUGHT' ? 'deal(s)' : 'item(s)'} to go`
              : 'Almost there!'}
          </p>
        )}
      </div>

      {/* Voucher section (if earned) */}
      {completed && voucher && (
        <div className="px-4 pb-4">
          <div className="border-t border-green-100 pt-3">
            <p className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1">
              <Trophy size={12} /> Your Voucher
            </p>
            <VoucherCard voucher={voucher} missionTitle={mission.title} />
          </div>
        </div>
      )}

      {/* Completed but voucher pending (shouldn't happen, safety fallback) */}
      {completed && !voucher && (
        <div className="px-4 pb-4">
          <div className="bg-green-50 rounded-xl px-3 py-2 text-center">
            <p className="text-xs text-green-600 font-medium">
              ✅ Completed! Voucher being processed…
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Login prompt ──────────────────────────────────────────────────────────────
const LoginPrompt = () => (
  <div className="bg-orange-50 border border-orange-200 rounded-2xl p-8 text-center">
    <Lock size={36} className="text-orange-400 mx-auto mb-3" />
    <h2 className="font-bold text-gray-900 text-lg mb-1">Login to See Your Missions</h2>
    <p className="text-sm text-gray-500 mb-5">Complete weekly missions and earn discount vouchers on your orders!</p>
    <div className="flex gap-3 justify-center">
      <Link to="/login"><Button variant="primary" size="sm">Login</Button></Link>
      <Link to="/signup"><Button variant="outline" size="sm">Sign Up</Button></Link>
    </div>
  </div>
);

// ── CountdownBox ──────────────────────────────────────────────────────────────
const CountdownBox = ({ value, label }) => (
  <div className="flex flex-col items-center bg-white/20 backdrop-blur-sm rounded-xl px-2.5 py-1.5 min-w-[48px]">
    <span className="text-lg font-extrabold text-white leading-none">{String(value).padStart(2, '0')}</span>
    <span className="text-[9px] text-white/70 font-medium uppercase tracking-wide mt-0.5">{label}</span>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const MissionsPage = () => {
  useSEO({
    title:       'Weekly Missions – ZOCK Cafe | Earn Discount Vouchers',
    description: 'Complete weekly missions at ZOCK Cafe Buch Villas Multan and earn discount vouchers. Buy items or deals to unlock rewards!',
    keywords:    'missions ZOCK Cafe, weekly missions Multan, discount vouchers Multan, ZOCK Cafe rewards',
    canonical:   'https://zouqcafe.com/missions',
  });

  const { user } = useAuthStore();
  const [data,     setData]     = useState(null); // { missions, weekStart, weekEnd }
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('active'); // 'active' | 'vouchers'
  const [vouchers, setVouchers] = useState([]);
  const [vLoading, setVLoading] = useState(false);
  const countdown = useResetCountdown();

  const load = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get('/missions');
      setData(res.data.data);
    } catch {
      toast.error('Failed to load missions');
    } finally {
      setLoading(false);
    }
  };

  const loadVouchers = async () => {
    if (!user) return;
    setVLoading(true);
    try {
      const res = await api.get('/missions/vouchers');
      setVouchers(res.data.data.vouchers || []);
    } catch {
      /* silently ignore */
    } finally {
      setVLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (tab === 'vouchers') loadVouchers();
  }, [tab]);

  const missions    = data?.missions || [];
  const completed   = missions.filter((m) => m.completed);
  const inProgress  = missions.filter((m) => !m.completed);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28">

      {/* ── Hero banner ── */}
      <div
        className="relative rounded-3xl overflow-hidden mb-6 shadow-xl"
        style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ea580c 60%, #f59e0b 100%)' }}
      >
        <div className="absolute inset-0 overflow-hidden opacity-10 select-none pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <span
              key={i}
              className="absolute text-4xl"
              style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, transform: `rotate(${Math.random() * 360}deg)` }}
            >
              🎯
            </span>
          ))}
        </div>

        <div className="relative px-5 py-6">
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full mb-3">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            WEEKLY MISSIONS
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-1">Complete Missions</h1>
          <p className="text-white/80 text-sm mb-4">Earn discount vouchers by shopping this week!</p>

          {/* Reset countdown */}
          <div>
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-1.5">
              Resets in (Monday 5 AM PKT)
            </p>
            <div className="flex gap-2">
              {countdown.days > 0 && <CountdownBox value={countdown.days}    label="Days"  />}
              <CountdownBox value={countdown.hours}   label="Hours" />
              <CountdownBox value={countdown.minutes} label="Mins"  />
              <CountdownBox value={countdown.seconds} label="Secs"  />
            </div>
          </div>
        </div>
      </div>

      {/* ── Not logged in ── */}
      {!user && <LoginPrompt />}

      {user && (
        <>
          {/* ── Stats strip ── */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total',     value: missions.length,   color: 'text-gray-700',   bg: 'bg-white' },
              { label: 'Done',      value: completed.length,  color: 'text-green-600',  bg: 'bg-green-50' },
              { label: 'Remaining', value: inProgress.length, color: 'text-orange-500', bg: 'bg-orange-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-2xl p-3 shadow-sm text-center`}>
                <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 font-medium">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-2 mb-5 bg-white rounded-2xl p-1 shadow-sm">
            {[
              { id: 'active',   label: 'Missions',  icon: Target },
              { id: 'vouchers', label: 'My Vouchers', icon: Ticket },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  tab === id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-orange-500'
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          {/* ── Missions tab ── */}
          {tab === 'active' && (
            <div className="space-y-4">
              {missions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Target size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-semibold">No missions available right now</p>
                  <p className="text-sm mt-1">Check back soon!</p>
                </div>
              ) : (
                <>
                  {/* In-progress missions first */}
                  {inProgress.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">
                        In Progress ({inProgress.length})
                      </p>
                      <div className="space-y-3">
                        {inProgress.map((m) => <MissionCard key={m.id} mission={m} />)}
                      </div>
                    </div>
                  )}

                  {/* Completed missions */}
                  {completed.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3 px-1 flex items-center gap-1">
                        <CheckCircle size={12} /> Completed ({completed.length})
                      </p>
                      <div className="space-y-3">
                        {completed.map((m) => <MissionCard key={m.id} mission={m} />)}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* How it works */}
              <div className="bg-white rounded-2xl p-5 shadow-sm mt-2">
                <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Star size={16} className="text-amber-500" /> How it works
                </h2>
                <div className="space-y-3">
                  {[
                    { icon: '🛒', text: 'Place orders and get them delivered within the week' },
                    { icon: '📈', text: 'Your progress updates automatically after each delivery' },
                    { icon: '🎟️', text: 'Complete a mission to instantly earn a discount voucher' },
                    { icon: '💳', text: 'Apply the voucher code at checkout on qualifying orders' },
                    { icon: '🔄', text: 'Missions reset every Monday at 5 AM PKT — incomplete progress is cleared' },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-start gap-3 text-sm text-gray-600">
                      <span className="text-xl flex-shrink-0 w-7 text-center">{icon}</span>
                      <span className="leading-snug">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white text-center shadow-md">
                <ShoppingBag size={28} className="mx-auto mb-2 text-white/80" />
                <p className="font-extrabold text-lg mb-1">Start Completing Missions!</p>
                <p className="text-white/80 text-sm mb-4">Order food, get it delivered, and watch your progress grow.</p>
                <Link to="/menu">
                  <button className="bg-white text-orange-600 font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-orange-50 transition-colors active:scale-[0.97]">
                    Order Now
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* ── Vouchers tab ── */}
          {tab === 'vouchers' && (
            <div>
              {vLoading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : vouchers.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Ticket size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-semibold">No vouchers yet</p>
                  <p className="text-sm mt-1">Complete a mission to earn your first voucher!</p>
                  <button
                    onClick={() => setTab('active')}
                    className="mt-4 text-orange-500 text-sm font-semibold flex items-center gap-1 mx-auto"
                  >
                    <Target size={14} /> View Missions
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pending vouchers */}
                  {vouchers.filter((v) => !v.redeemed && new Date(v.expiresAt) >= new Date()).length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-3 px-1">
                        Ready to Use ({vouchers.filter((v) => !v.redeemed && new Date(v.expiresAt) >= new Date()).length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {vouchers
                          .filter((v) => !v.redeemed && new Date(v.expiresAt) >= new Date())
                          .map((v) => (
                            <VoucherCard key={v.id} voucher={v} missionTitle={v.mission?.title || 'Mission'} />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Used / expired vouchers */}
                  {vouchers.filter((v) => v.redeemed || new Date(v.expiresAt) < new Date()).length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
                        Used / Expired
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {vouchers
                          .filter((v) => v.redeemed || new Date(v.expiresAt) < new Date())
                          .map((v) => (
                            <VoucherCard key={v.id} voucher={v} missionTitle={v.mission?.title || 'Mission'} />
                          ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-400 text-center mt-2">
                    Tap a voucher code to copy it, then paste it at checkout.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MissionsPage;
