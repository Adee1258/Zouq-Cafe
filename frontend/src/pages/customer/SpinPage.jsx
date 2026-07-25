import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Gift, Trophy, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import useAuthStore from '../../stores/authStore';
import Spinner from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';

// ── Spin Wheel Canvas ─────────────────────────────────────────────────────────
const SpinWheel = ({ prizes, targetIndex, spinning, onSpinEnd }) => {
  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const animRef = useRef(null);

  const segmentAngle = prizes.length > 0 ? (2 * Math.PI) / prizes.length : 0;

  // Draw the wheel
  const drawWheel = (currentAngle) => {
    const canvas = canvasRef.current;
    if (!canvas || prizes.length === 0) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = cx - 8;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    prizes.forEach((prize, i) => {
      const startAngle = currentAngle + i * segmentAngle;
      const endAngle = startAngle + segmentAngle;

      // Segment fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = prize.color || '#F97316';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(9, Math.min(13, 240 / prizes.length))}px sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 3;

      // Wrap long text
      const maxWidth = radius * 0.6;
      const words = prize.name.split(' ');
      let line = '';
      let lineY = -8;
      words.forEach((word, wi) => {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > maxWidth && wi > 0) {
          ctx.fillText(line, radius - 14, lineY);
          line = word;
          lineY += 14;
        } else {
          line = test;
        }
      });
      ctx.fillText(line, radius - 14, lineY);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#E85D04';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Center icon
    ctx.fillStyle = '#E85D04';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎁', cx, cy);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    drawWheel(angleRef.current);
  }, [prizes]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!spinning || prizes.length === 0) return;

    // Calculate target angle so pointer (top = -π/2) lands on targetIndex segment
    const spinRevolutions = 5 + Math.random() * 3; // 5–8 full spins
    const targetSegmentAngle = -(targetIndex * segmentAngle + segmentAngle / 2) - Math.PI / 2;
    const totalSpin = spinRevolutions * 2 * Math.PI + ((targetSegmentAngle - angleRef.current) % (2 * Math.PI));

    const duration = 4000;
    const startTime = performance.now();
    const startAngle = angleRef.current;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startAngle + totalSpin * eased;
      angleRef.current = current;
      drawWheel(current);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        onSpinEnd?.();
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [spinning, targetIndex]);

  return (
    <div className="relative inline-block">
      {/* Pointer triangle at top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
        <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[20px] border-l-transparent border-r-transparent border-b-orange-500 drop-shadow" />
      </div>
      <canvas
        ref={canvasRef}
        width={300}
        height={300}
        className="rounded-full shadow-2xl"
      />
    </div>
  );
};

// ── Win Modal ─────────────────────────────────────────────────────────────────
const WinModal = ({ prize, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center animate-bounce-in">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">You Won!</h2>
      <div
        className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center text-4xl"
        style={{ backgroundColor: prize.color + '33' }}
      >
        {prize.imageUrl ? (
          <img src={prize.imageUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
        ) : '🎁'}
      </div>
      <p className="text-xl font-bold mb-1" style={{ color: prize.color }}>{prize.name}</p>
      {prize.description && <p className="text-gray-500 text-sm mb-6">{prize.description}</p>}
      <p className="text-xs text-gray-400 mb-5">Show this to our staff to claim your prize!</p>
      <Button variant="primary" fullWidth onClick={onClose}>Awesome! 🙌</Button>
    </div>
  </div>
);

// ── Main Spin Page ────────────────────────────────────────────────────────────
const SpinPage = () => {
  const { user } = useAuthStore();
  const [prizes, setPrizes] = useState([]);
  const [config, setConfig] = useState({ dailyLimit: 1, spinsLeft: 1 });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const [wonPrize, setWonPrize] = useState(null);

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
      // wonPrize is shown after animation ends (onSpinEnd)
      setTimeout(() => setWonPrize(prize), 4200);
      // Add to local history
      setHistory((prev) => [{ id: Date.now(), prize, spunAt: new Date().toISOString(), redeemed: false }, ...prev].slice(0, 20));
    } catch (err) {
      toast.error(err.message);
      setSpinning(false);
    }
  };

  const handleSpinEnd = () => {
    setSpinning(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-2">🎡</div>
        <h1 className="text-3xl font-extrabold text-gray-900">Spin & Win</h1>
        <p className="text-gray-500 mt-1">Spin the wheel for a chance to win amazing prizes!</p>
      </div>

      {/* Not logged in */}
      {!user && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 text-center mb-6">
          <Lock size={28} className="text-orange-400 mx-auto mb-2" />
          <p className="font-semibold text-gray-900 mb-1">Login required</p>
          <p className="text-sm text-gray-500 mb-4">Create a free account to spin and win prizes.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/login" className="bg-orange-500 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-orange-600 transition-colors text-sm">
              Login
            </Link>
            <Link to="/signup" className="border border-orange-500 text-orange-500 font-bold px-6 py-2.5 rounded-xl hover:bg-orange-50 transition-colors text-sm">
              Sign Up
            </Link>
          </div>
        </div>
      )}

      {/* Spin counter */}
      {user && (
        <div className="flex items-center justify-center gap-3 mb-6">
          {Array.from({ length: config.dailyLimit }).map((_, i) => (
            <div
              key={i}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all ${
                i < config.spinsLeft
                  ? 'bg-orange-500 border-orange-500 text-white'
                  : 'bg-gray-100 border-gray-200 text-gray-300'
              }`}
            >
              🎡
            </div>
          ))}
          <span className="text-sm text-gray-500 font-medium">
            {config.spinsLeft} spin{config.spinsLeft !== 1 ? 's' : ''} left today
          </span>
        </div>
      )}

      {/* Wheel */}
      {prizes.length > 0 ? (
        <div className="flex flex-col items-center gap-6">
          <SpinWheel
            prizes={prizes}
            targetIndex={targetIndex}
            spinning={spinning}
            onSpinEnd={handleSpinEnd}
          />

          <Button
            variant="primary"
            size="lg"
            onClick={handleSpin}
            disabled={!user || config.spinsLeft <= 0 || spinning}
            isLoading={spinning}
            className="px-12 shadow-lg shadow-orange-200"
          >
            {spinning ? 'Spinning...' : config.spinsLeft <= 0 ? 'Come back tomorrow!' : '🎡 SPIN!'}
          </Button>
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Gift size={40} className="mx-auto mb-3 text-gray-300" />
          <p>No prizes available right now. Check back soon!</p>
        </div>
      )}

      {/* Prize list */}
      {prizes.length > 0 && (
        <div className="mt-10">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Gift size={18} className="text-orange-500" /> Available Prizes
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {prizes.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3 border-l-4"
                style={{ borderLeftColor: p.color }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: p.color + '22' }}>
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover rounded-xl" /> : '🎁'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-gray-400 truncate">{p.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Win history */}
      {user && history.length > 0 && (
        <div className="mt-10">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-amber-500" /> Your Wins
          </h2>
          <div className="space-y-2">
            {history.slice(0, 5).map((h) => (
              <div key={h.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: h.prize?.color || '#ccc' }} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{h.prize?.name}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(h.spunAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${h.redeemed ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                  {h.redeemed ? 'Redeemed' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {wonPrize && <WinModal prize={wonPrize} onClose={() => setWonPrize(null)} />}
    </div>
  );
};

export default SpinPage;
