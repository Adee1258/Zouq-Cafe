// useNewOrderNotifier — listens for new orders via Socket.IO (real-time)
// Falls back to polling if socket is not connected
import { useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import socket from '../lib/socket';
import api from '../lib/api';
import { playNewOrderSound } from '../utils/sounds';

const POLL_INTERVAL  = 30_000;
const STORAGE_KEY    = 'zouq_last_seen_order_id';

const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

const showBrowserNotification = (count) => {
  if (Notification.permission !== 'granted') return;
  const n = new Notification('🔔 New Order(s) — Zouq Cafe', {
    body: `${count} new order${count > 1 ? 's' : ''} waiting for your approval.`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'new-order',
    requireInteraction: true,
  });
  n.onclick = () => {
    window.focus();
    window.location.href = '/admin/orders?status=PENDING';
    n.close();
  };
};

const useNewOrderNotifier = (onNewOrders) => {
  const lastSeenIdRef          = useRef(Number(localStorage.getItem(STORAGE_KEY) || 0));
  const permissionRequestedRef = useRef(false);

  // ── Socket-based real-time notification ───────────────────────────────────
  useEffect(() => {
    if (!permissionRequestedRef.current) {
      permissionRequestedRef.current = true;
      requestNotificationPermission();
    }

    const handleNewOrder = (order) => {
      if (order.id <= lastSeenIdRef.current) return;

      playNewOrderSound();
      showBrowserNotification(1);

      toast(
        `🔔 New Order #${order.id} — Rs. ${Number(order.totalAmount).toLocaleString()}`,
        { duration: 8000, id: `new-order-${order.id}` }
      );

      lastSeenIdRef.current = order.id;
      localStorage.setItem(STORAGE_KEY, String(order.id));
      onNewOrders?.(1);
    };

    socket.on('new_order', handleNewOrder);
    return () => socket.off('new_order', handleNewOrder);
  }, [onNewOrders]);

  // ── Polling fallback — runs every 30s in case socket drops ────────────────
  const poll = useCallback(async () => {
    try {
      const res    = await api.get('/orders/admin?status=PENDING&limit=10&page=1');
      const orders = res.data.data.orders || [];
      if (orders.length === 0) return;

      const maxId     = Math.max(...orders.map((o) => o.id));
      const newOrders = orders.filter((o) => o.id > lastSeenIdRef.current);

      if (newOrders.length > 0 && lastSeenIdRef.current > 0) {
        // Only fire if socket didn't already handle it
        playNewOrderSound();
        showBrowserNotification(newOrders.length);
        const total = newOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
        toast(
          `🔔 ${newOrders.length} New Order${newOrders.length > 1 ? 's' : ''}! — Rs. ${total.toLocaleString()}`,
          { duration: 8000, id: 'new-order-toast' }
        );
        onNewOrders?.(newOrders.length);
      }

      if (maxId > lastSeenIdRef.current) {
        lastSeenIdRef.current = maxId;
        localStorage.setItem(STORAGE_KEY, String(maxId));
      }
    } catch { /* silent */ }
  }, [onNewOrders]);

  useEffect(() => {
    // Set baseline on mount
    api.get('/orders/admin?status=PENDING&limit=1&page=1')
      .then((res) => {
        const orders = res.data.data.orders || [];
        if (orders.length > 0 && lastSeenIdRef.current === 0) {
          const maxId = Math.max(...orders.map((o) => o.id));
          lastSeenIdRef.current = maxId;
          localStorage.setItem(STORAGE_KEY, String(maxId));
        }
      }).catch(() => {});

    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);
};

export default useNewOrderNotifier;
