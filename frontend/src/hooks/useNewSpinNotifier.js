// useNewSpinNotifier — notifies admin when a customer wins a spin prize
// Listens via Socket.IO; falls back to polling spin history every 60s
import { useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import socket from '../lib/socket';
import api from '../lib/api';

const POLL_INTERVAL = 60_000;
const STORAGE_KEY   = 'zouq_last_seen_spin_id';

const showBrowserNotification = ({ userName, prizeName }) => {
  if (Notification.permission !== 'granted') return;
  const n = new Notification('🎰 Spin Prize Won — Zouq Cafe', {
    body: `${userName} just won: ${prizeName}`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'spin-win',
  });
  n.onclick = () => {
    window.focus();
    window.location.href = '/admin/spin';
    n.close();
  };
};

const useNewSpinNotifier = (onNewSpin) => {
  const lastSeenIdRef = useRef(Number(localStorage.getItem(STORAGE_KEY) || 0));

  // ── Socket-based real-time notification ────────────────────────────────────
  useEffect(() => {
    const handleSpinWin = ({ spinId, user, prize }) => {
      if (spinId <= lastSeenIdRef.current) return;

      const userName  = user?.name || 'A customer';
      const prizeName = prize?.name || 'a prize';

      showBrowserNotification({ userName, prizeName });

      toast(`🎰 ${userName} won: ${prizeName}`, {
        duration: 8000,
        id: `spin-win-${spinId}`,
      });

      lastSeenIdRef.current = spinId;
      localStorage.setItem(STORAGE_KEY, String(spinId));
      onNewSpin?.({ user, prize });
    };

    socket.on('spin_prize_won', handleSpinWin);

    // When customer self-redeems — update admin unredeemed count
    const handleSelfRedeemed = () => onNewSpin?.({ selfRedeemed: true });
    socket.on('spin_prize_redeemed', handleSelfRedeemed);

    return () => {
      socket.off('spin_prize_won', handleSpinWin);
      socket.off('spin_prize_redeemed', handleSelfRedeemed);
    };
  }, [onNewSpin]);

  // ── Polling fallback ───────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const res     = await api.get('/admin/spin/history?limit=5&redeemed=false');
      const history = res.data.data.history || [];
      if (history.length === 0) return;

      const maxId    = Math.max(...history.map((h) => h.id));
      const newWins  = history.filter((h) => h.id > lastSeenIdRef.current);

      if (newWins.length > 0 && lastSeenIdRef.current > 0) {
        newWins.forEach(({ id, user, prize }) => {
          if (id <= lastSeenIdRef.current) return;
          const userName  = user?.name || 'A customer';
          const prizeName = prize?.name || 'a prize';
          showBrowserNotification({ userName, prizeName });
          toast(`🎰 ${userName} won: ${prizeName}`, {
            duration: 7000,
            id: `spin-poll-${id}`,
          });
          onNewSpin?.({ user, prize });
        });
      }

      if (maxId > lastSeenIdRef.current) {
        lastSeenIdRef.current = maxId;
        localStorage.setItem(STORAGE_KEY, String(maxId));
      }
    } catch { /* silent */ }
  }, [onNewSpin]);

  useEffect(() => {
    // Set baseline on mount — don't notify for already-existing spins
    api.get('/admin/spin/history?limit=1')
      .then((res) => {
        const history = res.data.data.history || [];
        if (history.length > 0 && lastSeenIdRef.current === 0) {
          lastSeenIdRef.current = history[0].id;
          localStorage.setItem(STORAGE_KEY, String(history[0].id));
        }
      })
      .catch(() => {});

    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);
};

export default useNewSpinNotifier;
