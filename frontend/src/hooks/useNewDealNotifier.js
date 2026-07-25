// useNewDealNotifier — listens for new featured deals via Socket.IO (real-time)
// Falls back to polling every 60s if socket drops
import { useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import socket from '../lib/socket';
import api from '../lib/api';
import { playNewDealSound } from '../utils/sounds';

const POLL_INTERVAL = 60_000;
const STORAGE_KEY   = 'zouq_last_seen_deal_id';

const requestPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

const showDealNotification = (deal) => {
  if (Notification.permission !== 'granted') return;
  const n = new Notification('🔥 New Deal — Zouq Cafe', {
    body: `${deal.title} — Rs. ${Number(deal.dealPrice).toLocaleString()}. Limited time offer!`,
    icon: deal.imageUrl || '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'new-deal',
    requireInteraction: false,
  });
  n.onclick = () => { window.focus(); window.location.href = '/deals'; n.close(); };
};

const useNewDealNotifier = () => {
  const lastSeenIdRef          = useRef(Number(localStorage.getItem(STORAGE_KEY) || 0));
  const permissionRequestedRef = useRef(false);
  const isFirstPollRef         = useRef(true);

  // ── Socket-based real-time notification ───────────────────────────────────
  useEffect(() => {
    if (!permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      requestPermission();
    }

    const handleFeaturedDeal = (deal) => {
      if (deal.id <= lastSeenIdRef.current) return;

      playNewDealSound();
      showDealNotification(deal);
      toast.success(
        `🔥 New Deal: ${deal.title} — Rs. ${Number(deal.dealPrice).toLocaleString()}`,
        { duration: 9000, id: `new-deal-${deal.id}` }
      );

      lastSeenIdRef.current = deal.id;
      localStorage.setItem(STORAGE_KEY, String(deal.id));
    };

    socket.on('new_featured_deal', handleFeaturedDeal);
    return () => socket.off('new_featured_deal', handleFeaturedDeal);
  }, []);

  // ── Polling fallback ───────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const res   = await api.get('/deals?featured=true&active=true');
      const deals = res.data.data.deals || [];
      if (deals.length === 0) return;

      const maxId    = Math.max(...deals.map((d) => d.id));
      const newDeals = deals.filter((d) => d.id > lastSeenIdRef.current);

      if (isFirstPollRef.current) {
        isFirstPollRef.current = false;
        if (lastSeenIdRef.current === 0) {
          lastSeenIdRef.current = maxId;
          localStorage.setItem(STORAGE_KEY, String(maxId));
        }
        return;
      }

      if (newDeals.length > 0) {
        playNewDealSound();
        newDeals.slice(0, 2).forEach((deal) => showDealNotification(deal));
        const deal = newDeals[0];
        toast.success(
          `🔥 New Deal: ${deal.title} — Rs. ${Number(deal.dealPrice).toLocaleString()}`,
          { duration: 9000, id: 'new-deal-toast' }
        );
        lastSeenIdRef.current = maxId;
        localStorage.setItem(STORAGE_KEY, String(maxId));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);
};

export default useNewDealNotifier;
