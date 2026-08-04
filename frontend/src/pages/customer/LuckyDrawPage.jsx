import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Lock, CheckCircle, Ticket,
  ShoppingBag, ChevronRight, Star, Users, Target,
} from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../stores/authStore';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import useSEO from '../../hooks/useSEO';

// ── Entry Progress Bar ────────────────────────────────────────────────────────
const EntryProgress = ({ current, max }) => {
  const pct = Math.min(100, Math.round((current / max) * 100));
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-gray-700">Qualified Entries</span>
        <span className="text-xs font-bold text-orange-500">
          {current} / {max} users
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-orange-400 to-amber-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-xs text-gray-400">{pct}% complete</span>
        {current < max && (
          <span className="text-xs text-orange-500 font-medium">
            {max - current} more users needed
          </span>
        )}
        {current >= max && (
          <span className="text-xs text-green-600 font-bold">🎯 Draw ready!</span>
        )}
      </div>
    </div>
  );
};

// ── Spend Progress ────────────────────────────────────────────────────────────
const SpendProgress = ({ spent, target, qualified }) => {
  const pct = Math.min(100, Math.round((spent / target) * 100));
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <span className="text-sm font-semibold text-gray-700">Best Single Order</span>
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
        <span className="text-xs text-gray-400">{pct}% of target</span>
        {!qualified && (
          <span className="text-xs text-orange-500 font-medium">
            Place one order of Rs. {Number(target).toLocaleString()}+ to qualify
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
    description: 'Join the Zouq Cafe Lucky Draw in Buch Villas Multan! Order food, qualify and win amazing prizes.',
    keywords:    'lucky draw Multan, restaurant lucky draw Buch Villas, win prizes Multan, Zouq Cafe lucky draw',
    canonical:   'https://zouqcafe.com/lucky-draw',
  });

  const { user } = useAuthStore();
  const [data,    setData]    = useState(null);
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const draw          = data?.draw;
  const qualified     = data?.qualified ?? false;
  const spent         = data?.myTotalSpent ?? 0;
  const target        = data?.minSpendAmount ?? 0;
  const currentEntries = data?.currentEntries ?? 0;
  const maxEntries    = data?.maxEntries ?? 100;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-28">

      {/* ── Hero banner — clean image only, no overlay text ── */}
      <div className="rounded-3xl overflow-hidden mb-5 shadow-xl">
        <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
          {draw?.bannerUrl ? (
            <img src={draw.bannerUrl} alt={draw?.title || 'Lucky Draw'}
              className="w-full h-full object-cover block" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 60%, #f97316 100%)' }}>
              <span className="text-8xl select-none">🎟️</span>
            </div>
          )}
          {/* Live badge only — no title, no progress on image */}
          {draw && (
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1.5 bg-green-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                LIVE
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Title below banner ── */}
      {draw ? (
        <h1 className="text-2xl font-extrabold text-gray-900 mb-5">{draw.title}</h1>
      ) : (
        <h1 className="text-2xl font-extrabold text-gray-900 mb-5">Lucky Draw</h1>
      )}

      {/* ── No active draw ── */}
      {!draw && (
        <div className="text-center py-10">
          <Target size={44} className="mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-500">No active lucky draw right now.</p>
          <p className="text-sm text-gray-400 mt-1">Coming soon — keep ordering!</p>
        </div>
      )}

      {/* ── Active draw ── */}
      {draw && (
        <div className="space-y-5">

          {/* Description */}
          {draw.description && (
            <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border-l-4 border-orange-400">
              <p className="text-sm text-gray-700 leading-relaxed">{draw.description}</p>
            </div>
          )}

          {/* How to participate */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Star size={18} className="text-amber-500" /> How to Participate?
            </h2>
            <div className="space-y-3">
              {[
                { icon: '1️⃣', text: `Place a SINGLE order of Rs. ${Number(draw.minSpendAmount).toLocaleString()} or more` },
                { icon: '2️⃣', text: 'Order must be Delivered — your name is automatically added to the list' },
                { icon: '3️⃣', text: 'Ordering multiple times does NOT give extra entries — one name per customer' },
                { icon: '4️⃣', text: `When ${maxEntries} unique customers qualify, admin picks one lucky winner` },
                { icon: '5️⃣', text: 'Winner must visit the cafe to claim their prize' },
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
                <Link to="/login"><Button variant="primary" size="sm">Login</Button></Link>
                <Link to="/signup"><Button variant="outline" size="sm">Sign Up</Button></Link>
              </div>
            </div>
          ) : qualified ? (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-5"
              style={{ animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
              <style>{`@keyframes popIn{from{transform:scale(0.95);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-extrabold text-green-700 text-lg">You're In! ✨</p>
                  <p className="text-sm text-green-600">Your name is in the lucky draw list</p>
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
              <p className="text-xs text-gray-400 text-center">
                Draw happens when <strong>{maxEntries} unique customers</strong> qualify.
                Currently <strong>{currentEntries}</strong> are in.
              </p>
            </div>
          ) : (
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
                  <ShoppingBag size={16} className="mr-2" /> Order Now
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </Link>
            </div>
          )}

          {/* Overall entry count card */}
          <div className="bg-white rounded-2xl px-5 py-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-orange-400" />
              <span className="text-sm font-bold text-gray-700">Draw Progress</span>
            </div>
            <EntryProgress current={currentEntries} max={maxEntries} />
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
                  <p className="text-xs text-gray-400">
                    {w.draw?.title} · {new Date(w.wonAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
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
