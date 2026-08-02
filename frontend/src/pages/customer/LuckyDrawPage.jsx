import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Lock, CheckCircle, Clock, Ticket,
  ShoppingBag, ChevronRight, Star, Users,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../stores/authStore';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import useSEO from '../../hooks/useSEO';

// ── Countdown timer ───────────────────────────────────────────────────────────
const useCountdown = (targetDate) => {
  const calc = () => {
    const diff = new Date(targetDate) - new Date();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
    return {
      days:    Math.floor(diff / 86400000),
      hours:   Math.floor((diff % 86400000) / 3600000),
      minutes: Math.floor((diff % 3600000)  / 60000),
      seconds: Math.floor((diff % 60000)    / 1000),
      done:    false,
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(t);
  }, [targetDate]);
  return time;
};

// ── Countdown box ─────────────────────────────────────────────────────────────
const CountdownBox = ({ value, label }) => (
  <div className="flex flex-col items-center bg-white/20 backdrop-blur-sm rounded-2xl px-3 py-2 min-w-[58px]">
    <span className="text-2xl font-extrabold text-white leading-none">
      {String(value).padStart(2, '0')}
    </span>
    <span className="text-[10px] text-white/70 font-medium mt-0.5 uppercase tracking-wide">{label}</span>
  </div>
);

// ── Progress bar ──────────────────────────────────────────────────────────────
const SpendProgress = ({ spent, target, qualified }) => {
  const pct = Math.min(100, (spent / target) * 100);
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-sm font-semibold text-gray-700">Your Progress</span>
        <span className={`text-xs font-bold ${qualified ? 'text-green-600' : 'text-orange-500'}`}>
          Rs. {Math.round(spent).toLocaleString()} / Rs. {Number(target).toLocaleString()}
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${qualified ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-orange-400 to-amber-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-xs text-gray-400">{Math.round(pct)}% complete</span>
        {!qualified && (
          <span className="text-xs text-orange-500 font-medium">
            Rs. {Math.max(0, Number(target) - Math.round(spent)).toLocaleString()} more needed
          </span>
        )}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const LuckyDrawPage = () => {
  useSEO({
    title:       'Lucky Draw – Zouq Cafe Buch Villas Multan | Win Big Prizes',
    description: 'Join the Zouq Cafe Lucky Draw in Buch Villas Multan! Order food, qualify and win amazing prizes. The more you order, the better your chances!',
    keywords:    'lucky draw Multan, restaurant lucky draw Buch Villas, win prizes Multan, Zouq Cafe lucky draw, free prize Multan restaurant',
    canonical:   'https://zouqcafe.com/lucky-draw',
  });

  const { user } = useAuthStore();
  const [data,    setData]    = useState(null);  // { draw, myEntry, myTotalSpent, qualified }
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);
  const countdown = useCountdown(data?.draw?.endsAt || new Date());

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [activeRes, winnersRes] = await Promise.all([
          api.get('/lucky-draw/active'),
          api.get('/lucky-draw/winners'),
        ]);
        setData(activeRes.data.data);
        setWinners(winnersRes.data.data.winners);
      } catch { /* keep */ }
      finally { setLoading(false); }
    };
    fetchAll();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>;
  }

  const draw     = data?.draw;
  const qualified = data?.qualified ?? false;
  const spent    = data?.myTotalSpent ?? 0;
  const target   = data?.minSpendAmount ?? 0;
  const entryCount = draw?._count?.entries ?? 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-28">

      {/* ── Hero banner ── */}
      <div className="relative rounded-3xl overflow-hidden mb-6 shadow-xl">
        {/* 16:9 banner image OR gradient fallback */}
        <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
          {draw?.bannerUrl ? (
            <img
              src={draw.bannerUrl}
              alt={draw?.title || 'Lucky Draw'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full"
              style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 60%, #f97316 100%)' }}>
              {/* Decorative ticket pattern */}
              <div className="absolute inset-0 overflow-hidden opacity-10 select-none">
                {[
                  { top:'8%',  left:'5%'  }, { top:'15%', left:'30%' }, { top:'5%',  left:'60%' },
                  { top:'30%', left:'82%' }, { top:'55%', left:'10%' }, { top:'65%', left:'50%' },
                  { top:'75%', left:'75%' }, { top:'45%', left:'40%' }, { top:'80%', left:'20%' },
                ].map((s, i) => (
                  <span key={i} className="absolute text-5xl"
                    style={{ top: s.top, left: s.left, transform: 'rotate(12deg)' }}>🎟️</span>
                ))}
              </div>
            </div>
          )}

          {/* Dark gradient overlay at bottom for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          {/* Content overlaid on banner */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-8">
            {/* Live badge */}
            {draw && !countdown.done && (
              <span className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full mb-2">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </span>
            )}

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-lg">
              {draw?.title || 'Lucky Draw'}
            </h1>

            {!draw && (
              <p className="text-white/70 text-sm mt-1">No active draw right now — stay tuned!</p>
            )}

            {/* Countdown timer */}
            {draw && !countdown.done && (
              <div className="mt-3">
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-1.5">
                  Draw ends in
                </p>
                <div className="flex gap-2">
                  {countdown.days > 0 && <CountdownBox value={countdown.days}    label="Days" />}
                  <CountdownBox value={countdown.hours}   label="Hours" />
                  <CountdownBox value={countdown.minutes} label="Mins"  />
                  <CountdownBox value={countdown.seconds} label="Secs"  />
                </div>
              </div>
            )}

            {draw && countdown.done && (
              <div className="mt-3 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                <Clock size={14} className="text-white/70" />
                <p className="text-white text-sm font-semibold">Draw ended — winner announcement soon!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Description card (below banner) ── */}
      {draw?.description && (
        <div className="bg-white rounded-2xl px-5 py-4 shadow-sm mb-5 border-l-4 border-orange-400">
          <p className="text-sm text-gray-700 leading-relaxed">{draw.description}</p>
        </div>
      )}

      {/* ── No active draw ── */}
      {!draw && (
        <div className="text-center py-10">
          <Clock size={44} className="mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No active lucky draw right now.</p>
          <p className="text-sm text-gray-400 mt-1">Coming soon — keep ordering!</p>
        </div>
      )}

      {/* ── Active draw ── */}
      {draw && (
        <div className="space-y-5">

          {/* How to participate */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Star size={18} className="text-amber-500" /> How to Participate?
            </h2>
            <div className="space-y-3">
              {[
                { icon: '1️⃣', text: `Order Rs. ${Number(draw.minSpendAmount).toLocaleString()} or more during the draw period` },
                { icon: '2️⃣', text: 'After your order is Delivered, you are automatically added to the list' },
                { icon: '3️⃣', text: 'On the draw date, admin will randomly pick one lucky winner' },
                { icon: '4️⃣', text: 'Winner must visit the cafe to claim their prize' },
              ].map(({ icon, text }) => (
                <div key={icon} className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{icon}</span>
                  <p className="text-sm text-gray-600 leading-snug">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* User status card */}
          {!user ? (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center">
              <Lock size={28} className="text-orange-400 mx-auto mb-2" />
              <p className="font-bold text-gray-900 mb-1">Login Required</p>
              <p className="text-sm text-gray-500 mb-4">Please login to participate in the Lucky Draw</p>
              <div className="flex gap-3 justify-center">
                <Link to="/login">
                  <Button variant="primary" size="sm">Login</Button>
                </Link>
                <Link to="/signup">
                  <Button variant="outline" size="sm">Sign Up</Button>
                </Link>
              </div>
            </div>
          ) : qualified ? (
            /* Qualified */
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-5"
              style={{ animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <style>{`@keyframes popIn{from{transform:scale(0.95);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-extrabold text-green-700 text-lg">Congratulations! ✨</p>
                  <p className="text-sm text-green-600">You are qualified for this Lucky Draw</p>
                </div>
              </div>
              <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 mb-4">
                <Ticket size={18} className="text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Your Entry</p>
                  <p className="font-bold text-gray-900">{user.name}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-400">Total Spend</p>
                  <p className="font-extrabold text-orange-600">Rs. {Math.round(spent).toLocaleString()}</p>
                </div>
              </div>
              <SpendProgress spent={spent} target={target} qualified={true} />
              <p className="text-xs text-gray-400 text-center mt-3">
                Good luck! Draw result: <strong>{new Date(draw.endsAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </p>
            </div>
          ) : (
            /* Not yet qualified */
            <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-orange-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={20} className="text-orange-500" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Not qualified yet</p>
                  <p className="text-sm text-gray-500">Order more to enter the Lucky Draw!</p>
                </div>
              </div>
              <SpendProgress spent={spent} target={target} qualified={false} />
              <Link to="/menu" className="mt-4 block">
                <Button variant="primary" fullWidth>
                  <ShoppingBag size={16} className="mr-2" /> Menu Dekho
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </Link>
            </div>
          )}

          {/* Draw info strip */}
          <div className="bg-white rounded-2xl px-5 py-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users size={16} className="text-orange-400" />
              <span><strong className="text-gray-900">{entryCount}</strong> qualified entries</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock size={16} className="text-orange-400" />
              <span>Ends <strong className="text-gray-900">{new Date(draw.endsAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ── Past winners ── */}
      {winners.length > 0 && (
        <div className="mt-10">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-lg">
            <Trophy size={20} className="text-amber-500" /> Past Winners
          </h2>
          <div className="space-y-3">
            {winners.map((w) => (
              <div key={w.id} className="bg-white rounded-2xl px-5 py-4 shadow-sm flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white font-extrabold text-lg flex-shrink-0 select-none">
                  {w.user?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{w.user?.name}</p>
                  <p className="text-xs text-gray-400">{w.draw?.title} · {new Date(w.wonAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">Prize</p>
                  <p className="text-sm font-semibold text-orange-600 max-w-[100px] truncate">{w.prize}</p>
                </div>
                <Trophy size={18} className="text-amber-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LuckyDrawPage;
