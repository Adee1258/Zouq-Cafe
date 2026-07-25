// usePushNotifications — admin push notification subscription hook
import { useState, useEffect, useCallback } from 'react';
import api from './api';

// Convert VAPID public key (base64url) to Uint8Array for browser API
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const usePushNotifications = () => {
  const [supported,   setSupported]   = useState(false);
  const [permission,  setPermission]  = useState('default');
  const [subscribed,  setSubscribed]  = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

  // Check current state on mount
  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setSupported(ok);
    if (!ok) return;

    setPermission(Notification.permission);

    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub);
      });
    }).catch(() => {});
  }, []);

  // Register service worker (call once on app load)
  const registerSW = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      return reg;
    } catch (err) {
      console.error('[SW] Registration failed:', err);
      return null;
    }
  }, []);

  // Subscribe — request permission + create push subscription + save to backend
  const subscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Register SW if not already
      const reg = await navigator.serviceWorker.ready;

      // 2. Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Notification permission denied.');
        setLoading(false);
        return false;
      }

      // 3. Get VAPID public key from backend
      const keyRes = await api.get('/push/vapid-public-key');
      const vapidKey = urlBase64ToUint8Array(keyRes.data.data.publicKey);

      // 4. Subscribe via browser Push API
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: vapidKey,
      });

      // 5. Send subscription to backend
      await api.post('/push/subscribe', sub.toJSON());

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      setError(err.message || 'Failed to subscribe.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Unsubscribe — remove from browser + backend
  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.delete('/push/unsubscribe', { data: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      return true;
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
      setError(err.message || 'Failed to unsubscribe.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { supported, permission, subscribed, loading, error, subscribe, unsubscribe, registerSW };
};

export default usePushNotifications;
