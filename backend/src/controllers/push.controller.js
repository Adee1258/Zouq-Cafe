// Push notification controller — subscribe / unsubscribe / send
const webpush  = require('web-push');
const prisma   = require('../config/prisma');
const { success, error } = require('../utils/response');

// Configure VAPID once at module load
webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

// ─── GET /api/push/vapid-public-key ──────────────────────────────────────────
// Frontend calls this to get the public key for subscription
const getVapidPublicKey = (req, res) => {
  return success(res, { publicKey: process.env.VAPID_PUBLIC_KEY });
};

// ─── POST /api/push/subscribe ─────────────────────────────────────────────────
// Admin browser calls this after user grants notification permission
const subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return error(res, 'Invalid subscription object.', 400);
    }

    // Upsert — same endpoint may re-subscribe after browser restart
    await prisma.pushSubscription.upsert({
      where:  { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth, userId: req.user.id },
      create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: req.user.id },
    });

    return success(res, {}, 'Subscribed to push notifications.', 201);
  } catch (err) {
    console.error('[push.subscribe]', err);
    return error(res, 'Failed to save subscription.', 500);
  }
};

// ─── DELETE /api/push/unsubscribe ─────────────────────────────────────────────
const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return error(res, 'Endpoint required.', 400);

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: req.user.id },
    });

    return success(res, {}, 'Unsubscribed.');
  } catch (err) {
    console.error('[push.unsubscribe]', err);
    return error(res, 'Failed to remove subscription.', 500);
  }
};

// ─── Internal helper — send push to all admin subscriptions ──────────────────
const sendToAdmins = async (payload) => {
  try {
    // Get all admin users
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    const adminIds = admins.map((a) => a.id);
    if (adminIds.length === 0) return;

    const subs = await prisma.pushSubscription.findMany({
      where: { userId: { in: adminIds } },
    });

    const message = JSON.stringify(payload);
    const staleEndpoints = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            message,
          );
        } catch (err) {
          // 410 Gone = subscription expired / user unsubscribed
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleEndpoints.push(sub.endpoint);
          } else {
            console.error('[push.sendToAdmins] send error:', err.message);
          }
        }
      }),
    );

    // Clean up expired subscriptions
    if (staleEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: staleEndpoints } },
      });
    }
  } catch (err) {
    console.error('[push.sendToAdmins]', err);
  }
};

module.exports = { getVapidPublicKey, subscribe, unsubscribe, sendToAdmins };
