// Web Audio API — no external files needed, generates tones programmatically

const getCtx = () => {
  if (typeof window === 'undefined') return null;
  if (!window._zouqAudioCtx) {
    try {
      window._zouqAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return null; }
  }
  return window._zouqAudioCtx;
};

// Resume context if suspended (browsers require user gesture first)
const resumeCtx = async (ctx) => {
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* ignore */ }
  }
};

// ── Play a sequence of notes ───────────────────────────────────────────────
const playNotes = async (notes) => {
  const ctx = getCtx();
  if (!ctx) return;
  await resumeCtx(ctx);

  let time = ctx.currentTime;
  notes.forEach(({ freq, duration, type = 'sine', gain = 0.4 }) => {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(gain, time + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.start(time);
    osc.stop(time + duration + 0.05);

    time += duration * 0.85;
  });
};

// ── Admin: new order alert — urgent double ding ────────────────────────────
export const playNewOrderSound = () => playNotes([
  { freq: 880, duration: 0.12, type: 'sine',   gain: 0.5 },
  { freq: 660, duration: 0.12, type: 'sine',   gain: 0.4 },
  { freq: 880, duration: 0.20, type: 'sine',   gain: 0.5 },
]);

// ── Customer: new deal alert — cheerful 3-note chime ──────────────────────
export const playNewDealSound = () => playNotes([
  { freq: 523, duration: 0.12, type: 'sine', gain: 0.35 }, // C5
  { freq: 659, duration: 0.12, type: 'sine', gain: 0.35 }, // E5
  { freq: 784, duration: 0.20, type: 'sine', gain: 0.40 }, // G5
]);
