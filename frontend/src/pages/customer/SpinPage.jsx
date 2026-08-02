import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Trophy, Lock, Clock, CheckCircle, Ticket, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import useAuthStore from '../../stores/authStore';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import useSEO from '../../hooks/useSEO';

// ── Confetti burst on win ─────────────────────────────────────────────────────
const useConfetti = () => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animRef = useRef(null);

  const launch = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;
    const COLORS = ['#F97316','#FBBF24','#34D399','#60A5FA','#F472B6','#A78BFA','#FB923C'];
    particlesRef.current = Array.from({ length: 120 }, () => ({
      x: W / 2, y: H / 2,
      vx: (Math.random() - 0.5) * 18,
      vy: -(Math.random() * 14 + 4),
      size: Math.random() * 8 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 8,
      alpha: 1, shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particlesRef.current = particlesRef.current.filter(p => p.alpha > 0.05);
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4;
        p.vx *= 0.99; p.rotation += p.rotV; p.alpha -= 0.012;
        ctx.save(); ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y); ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
        else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      });
      if (particlesRef.current.length > 0) animRef.current = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, W, H);
    };
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);
  return { canvasRef, launch };
};

// ── Spin Wheel Canvas ─────────────────────────────────────────────────────────
const SpinWheel = ({ prizes, targetIndex, spinning, onSpinEnd }) => {
  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const animRef = useRef(null);
  const glowRef = useRef(null);
  const [glowPhase, setGlowPhase] = useState(0);

  const segmentAngle = prizes.length > 0 ? (2 * Math.PI) / prizes.length : 0;

  const drawWheel = useCallback((currentAngle) => {
    const canvas = canvasRef.current;
    if (!canvas || prizes.length === 0) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = cx - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Outer ring shadow
    ctx.save();
    ctx.shadowColor = 'rgba(232,93,4,0.35)';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = '#E85D04';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    prizes.forEach((prize, i) => {
      const startAngle = currentAngle + i * segmentAngle;
      const endAngle = startAngle + segmentAngle;
      const isEven = i % 2 === 0;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      // Gradient fill per segment
      const midAngle = startAngle + segmentAngle / 2;
      const gx1 = cx + (radius * 0.3) * Math.cos(midAngle);
      const gy1 = cy + (radius * 0.3) * Math.sin(midAngle);
      const gx2 = cx + radius * Math.cos(midAngle);
      const gy2 = cy + radius * Math.sin(midAngle);
      const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
      const base = prize.color || '#F97316';
      grad.addColorStop(0, base + 'cc');
      grad.addColorStop(1, base);
      ctx.fillStyle = isEven ? grad : base;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(9, Math.min(13, 280 / prizes.length))}px sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur = 4;
      const maxW = radius * 0.58;
      const words = prize.name.split(' ');
      let line = '', lineY = -7;
      words.forEach((word, wi) => {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > maxW && wi > 0) {
          ctx.fillText(line, radius - 16, lineY);
          line = word; lineY += 14;
        } else line = test;
      });
      ctx.fillText(line, radius - 16, lineY);
      ctx.restore();
    });

    // Center circle
    const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
    cGrad.addColorStop(0, '#fff');
    cGrad.addColorStop(1, '#fde8d8');
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
    ctx.fillStyle = cGrad;
    ctx.fill();
    ctx.strokeStyle = '#E85D04';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#E85D04';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎁', cx, cy);
  }, [prizes, segmentAngle]);

  useEffect(() => { drawWheel(angleRef.current); }, [prizes, drawWheel]);

  // Idle glow pulse
  useEffect(() => {
    if (spinning) return;
    let phase = 0;
    glowRef.current = setInterval(() => {
      phase = (phase + 0.05) % (2 * Math.PI);
      setGlowPhase(phase);
    }, 30);
    return () => clearInterval(glowRef.current);
  }, [spinning]);

  const glowSize = 8 + Math.sin(glowPhase) * 6;

  useEffect(() => {
    if (!spinning || prizes.length === 0) return;
    const spinRevolutions = 6 + Math.random() * 3;
    const targetSeg = -(targetIndex * segmentAngle + segmentAngle / 2) - Math.PI / 2;
    const totalSpin = spinRevolutions * 2 * Math.PI + ((targetSeg - angleRef.current) % (2 * Math.PI));
    const duration = 4500;
    const startTime = performance.now();
    const startAngle = angleRef.current;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      angleRef.current = startAngle + totalSpin * eased;
      drawWheel(angleRef.current);
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
      else onSpinEnd?.();
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [spinning, targetIndex, prizes, segmentAngle, drawWheel, onSpinEnd]);

  return (
    <div className="relative inline-block">
      {/* Animated glow ring */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none transition-all"
        style={{ boxShadow: spinning ? `0 0 ${glowSize * 3}px ${glowSize * 1.5}px rgba(232,93,4,0.5)` : `0 0 ${glowSize}px ${glowSize / 2}px rgba(232,93,4,0.25)`, borderRadius: '50%' }}
      />
      {/* Pointer */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 drop-shadow-lg">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-b-[24px] border-l-transparent border-r-transparent border-b-orange-500" />
      </div>
      <canvas ref={canvasRef} width={340} height={340} className="rounded-full" />
    </div>
  );
};

// ── Win Modal ─────────────────────────────────────────────────────────────────
const WinModal = ({ prize, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
    <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"
      style={{ animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
      <style>{`@keyframes popIn{from{transform:scale(0.6);opacity:0}to{transform:scale(1);opacity:1}}`}</style>

      {/* Rays */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="absolute top-1/2 left-1/2 origin-left h-0.5 opacity-10"
            style={{ width: '60%', transform: `rotate(${i * 45}deg)`, backgroundColor: prize.color || '#F97316' }} />
        ))}
      </div>

      <div className="text-6xl mb-3 animate-bounce">🎉</div>
      <h2 className="text-2xl font-extrabold text-gray-900 mb-4">You Won!</h2>

      <div className="w-24 h-24 rounded-3xl mx-auto mb-4 flex items-center justify-center text-5xl shadow-lg"
        style={{ backgroundColor: (prize.color || '#F97316') + '22', border: `3px solid ${prize.color || '#F97316'}40` }}>
        {prize.imageUrl
          ? <img src={prize.imageUrl} alt="" className="w-full h-full object-cover rounded-3xl" />
          : '🎁'}
      </div>

      <p className="text-2xl font-extrabold mb-2" style={{ color: prize.color || '#F97316' }}>{prize.name}</p>
      {prize.description && <p className="text-gray-500 text-sm mb-4">{prize.description}</p>}

      <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 mb-6">
        <p className="text-sm font-semibold text-orange-700">📲 Show this to our staff to claim your prize!</p>
      </div>

      <Button variant="primary" fullWidth onClick={onClose} className="shadow-lg shadow-orange-200">
        <Sparkles size={16} className="mr-2" /> Awesome!
      </Button>
    </div>
  </div>
);

// ── History Item ──────────────────────────────────────────────────────────────
const HistoryItem = ({ item, onUse }) => {
  const [loading, setLoading] = useState(false);

  const handleUse = async () => {
    setLoading(true);
    try {
      await onUse(item.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-white rounded-2xl px-4 py-3.5 shadow-sm flex items-center justify-between transition-all border-l-4 ${item.redeemed ? 'opacity-60' : ''}`}
      style={{ borderLeftColor: item.prize?.color || '#E5E7EB' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: (item.prize?.color || '#F97316') + '22' }}>
          {item.prize?.imageUrl
            ? <img src={item.prize.imageUrl} alt="" className="w-full h-full object-cover rounded-xl" />
            : '🎁'}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{item.prize?.name}</p>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Clock size={10} />
            {new Date(item.spunAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {item.redeemed ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-100 px-2.5 py-1 rounded-full">
            <CheckCircle size={11} /> Redeemed
          </span>
        ) : (
          <button onClick={handleUse} disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-full transition-colors disabled:opacity-60 min-h-[32px]">
            {loading ? '...' : <><Ticket size={11} /> Use</>}
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main Spin Page ────────────────────────────────────────────────────────────
const SpinPage = () => {
  useSEO({
    title:       'Spin & Win – Zouq Cafe Buch Villas Multan | Free Prizes Daily',
    description: 'Spin the wheel daily at Zouq Cafe, Buch Villas Multan! Win free food, discounts and exciting prizes. Login and spin to win every day!',
    keywords:    'spin and win Multan, free prizes Zouq Cafe, win food Buch Villas, daily spin Multan restaurant, Zouq Cafe promotions',
    canonical:   'https://zouqcafe.com/spin',
  });
  const { user } = useAuthStore();
  const [prizes, setPrizes]     = useState([]);
  const [config, setConfig]     = useState({ dailyLimit: 1, spinsLeft: 1 });
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const [wonPrize, setWonPrize] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const { canvasRef: confettiRef, launch: launchConfetti } = useConfetti();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prizeRes, configRes] = await Promise.all([
          api.get('/spin/prizes'),
          api.get('/spin/config'),
        ]);
        setPrizes(prizeRes.data.data.prizes);
        setConfig(configRes.data.data);
        if (user) {
          const histRes = await api.get('/spin/history');
          setHistory(histRes.data.data.history);
        }
      } catch { /* keep */ }
      finally { setLoading(false); }
    };
    fetchData();
  }, [user]);

  const handleSpin = async () => {
    if (!user) { toast.error('Please login to spin!'); return; }
    if (config.spinsLeft <= 0) { toast.error('No spins left today. Come back tomorrow!'); return; }
    if (spinning) return;
    setSpinning(true);
    try {
      const res = await api.post('/spin');
      const { prize, prizeIndex, spinsLeft } = res.data.data;
      setTargetIndex(prizeIndex);
      setConfig((c) => ({ ...c, spinsLeft }));
      setTimeout(() => { setWonPrize(prize); launchConfetti(); }, 4700);
      setHistory((prev) => [
        { id: Date.now(), prize, spunAt: new Date().toISOString(), redeemed: false },
        ...prev,
      ].slice(0, 20));
    } catch (err) {
      toast.error(err.message);
      setSpinning(false);
    }
  };

  const handleUseVoucher = async (spinId) => {
    try {
      await api.post(`/spin/history/${spinId}/use`);
      setHistory((prev) => prev.map((h) =>
        h.id === spinId ? { ...h, redeemed: true, redeemedAt: new Date().toISOString() } : h
      ));
      toast.success('Voucher marked as used! Show it to our staff 🎉');
    } catch (err) {
      toast.error(err.message || 'Failed to use voucher.');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;
  }

  const pendingCount = history.filter((h) => !h.redeemed).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
      {/* Confetti canvas — fixed, full screen, pointer-events-none */}
      <canvas ref={confettiRef} className="fixed inset-0 pointer-events-none z-40" />

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-3" style={{ filter: 'drop-shadow(0 4px 12px rgba(232,93,4,0.4))' }}>🎡</div>
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Spin & Win</h1>
        <p className="text-gray-500 mt-1.5 text-sm">Spin the wheel for a chance to win amazing prizes!</p>
      </div>

      {/* Not logged in */}
      {!user && (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-3xl p-7 text-center mb-8 shadow-sm">
          <Lock size={32} className="text-orange-400 mx-auto mb-3" />
          <p className="font-bold text-gray-900 text-lg mb-1">Login to Spin</p>
          <p className="text-sm text-gray-500 mb-5">Create a free account and get your daily spin!</p>
          <div className="flex gap-3 justify-center">
            <Link to="/login" className="bg-orange-500 text-white font-bold px-7 py-2.5 rounded-xl hover:bg-orange-600 transition-colors text-sm shadow-md shadow-orange-200">
              Login
            </Link>
            <Link to="/signup" className="border-2 border-orange-500 text-orange-600 font-bold px-7 py-2.5 rounded-xl hover:bg-orange-50 transition-colors text-sm">
              Sign Up
            </Link>
          </div>
        </div>
      )}

      {/* Spins counter */}
      {user && (
        <div className="flex items-center justify-center gap-3 mb-7">
          {Array.from({ length: config.dailyLimit }).map((_, i) => (
            <div key={i}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl border-2 transition-all shadow-sm ${
                i < config.spinsLeft
                  ? 'bg-orange-500 border-orange-400 text-white shadow-orange-200'
                  : 'bg-gray-100 border-gray-200 text-gray-300'
              }`}>
              🎡
            </div>
          ))}
          <div className="text-center">
            <p className="text-sm font-bold text-gray-800">{config.spinsLeft} / {config.dailyLimit}</p>
            <p className="text-xs text-gray-400">spins left today</p>
          </div>
        </div>
      )}

      {/* Wheel */}
      {prizes.length > 0 ? (
        <div className="flex flex-col items-center gap-7">
          <SpinWheel
            prizes={prizes}
            targetIndex={targetIndex}
            spinning={spinning}
            onSpinEnd={() => setSpinning(false)}
          />
          <Button
            variant="primary"
            size="lg"
            onClick={handleSpin}
            disabled={!user || config.spinsLeft <= 0 || spinning}
            isLoading={spinning}
            className="px-14 shadow-xl shadow-orange-200 text-lg font-extrabold tracking-wide"
          >
            {spinning ? 'Spinning…' : config.spinsLeft <= 0 ? '🌅 Come Back Tomorrow' : '🎡 SPIN NOW!'}
          </Button>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Gift size={44} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No prizes available right now. Check back soon!</p>
        </div>
      )}

      {/* Prize list */}
      {prizes.length > 0 && (
        <div className="mt-12">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-lg">
            <Gift size={20} className="text-orange-500" /> What Can You Win?
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {prizes.map((p) => (
              <div key={p.id}
                className="bg-white rounded-2xl p-4 shadow-sm flex flex-col items-center text-center gap-2 border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all"
                style={{ borderTopColor: p.color, borderTopWidth: 3 }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: p.color + '22' }}>
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-2xl" /> : '🎁'}
                </div>
                <p className="text-sm font-bold text-gray-900 leading-tight">{p.name}</p>
                {p.description && <p className="text-xs text-gray-400 leading-snug">{p.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Win history */}
      {user && history.length > 0 && (
        <div className="mt-12">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="w-full flex items-center justify-between bg-white rounded-2xl px-5 py-4 shadow-sm hover:bg-gray-50 transition-colors mb-3">
            <span className="font-bold text-gray-900 flex items-center gap-2 text-base">
              <Trophy size={18} className="text-amber-500" />
              Your Wins
              {pendingCount > 0 && (
                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {pendingCount} pending
                </span>
              )}
            </span>
            {showHistory ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>

          {showHistory && (
            <div className="space-y-2">
              {history.slice(0, 10).map((h) => (
                <HistoryItem key={h.id} item={h} onUse={handleUseVoucher} />
              ))}
              {history.length > 10 && (
                <p className="text-center text-xs text-gray-400 py-2">Showing last 10 wins</p>
              )}
            </div>
          )}
        </div>
      )}

      {wonPrize && <WinModal prize={wonPrize} onClose={() => setWonPrize(null)} />}
    </div>
  );
};

export default SpinPage;
