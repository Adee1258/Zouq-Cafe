/**
 * Payment Controller — EasyPaisa Hosted Checkout (EasyPay)
 *
 * Flow:
 *  1. Customer selects "Online Payment" → POST /api/payments/initiate
 *  2. Backend generates hash → returns EasyPaisa checkout URL
 *  3. Customer redirects to EasyPaisa, completes payment
 *  4. EasyPaisa POSTs callback → POST /api/payments/easypaisa/callback
 *  5. Backend verifies hash → marks order APPROVED
 *
 * Sandbox portal: https://easypaystg.easypaisa.com.pk
 * Live portal:    https://easypay.easypaisa.com.pk
 *
 * To get credentials: apply at https://easypaisa.com.pk/online-payment-gateway/
 */

const crypto  = require('crypto');
const prisma  = require('../config/prisma');
const { success, error } = require('../utils/response');

// ─── Config ───────────────────────────────────────────────────────────────────
const STORE_ID   = process.env.EASYPAISA_STORE_ID;
const HASH_KEY   = process.env.EASYPAISA_HASH_KEY;
const EP_ENV     = process.env.EASYPAISA_ENV || 'sandbox';

// EasyPaisa gateway URLs
const GATEWAY_URL = EP_ENV === 'production'
  ? 'https://easypay.easypaisa.com.pk/tpg/'
  : 'https://easypaystg.easypaisa.com.pk/tpg/';

// ─── Helper: Generate EasyPaisa HMAC-SHA256 hash ─────────────────────────────
/**
 * EasyPaisa requires a hash of specific params in a fixed order,
 * joined by '&' and signed with HMAC-SHA256 using the Hash Key.
 *
 * Required param order (from EasyPaisa docs):
 * amount & expiryDate & merchantOrderId & orderDesc & postBackURL &
 * storeId & tansactionType & tokenExpiry
 */
const generateHash = (params) => {
  // Sort keys alphabetically as required by EasyPaisa
  const sortedKeys = Object.keys(params).sort();
  const hashString = sortedKeys.map((k) => params[k]).join('&');
  return crypto
    .createHmac('sha256', HASH_KEY)
    .update(hashString)
    .digest('hex')
    .toUpperCase();
};

// ─── POST /api/payments/initiate ─────────────────────────────────────────────
const initiatePayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!STORE_ID || !HASH_KEY || STORE_ID === 'your_store_id_here') {
      return error(
        res,
        'EasyPaisa credentials not configured. Set EASYPAISA_STORE_ID and EASYPAISA_HASH_KEY in .env',
        503
      );
    }

    const order = await prisma.order.findFirst({
      where: { id: Number(orderId), userId: req.user.id },
      include: { payment: true },
    });

    if (!order)                                    return error(res, 'Order not found.', 404);
    if (order.paymentType !== 'ONLINE')            return error(res, 'This order is Cash on Delivery.', 400);
    if (order.payment?.status === 'COMPLETED')     return error(res, 'Already paid.', 400);

    // EasyPaisa requires amount as string with 2 decimal places
    const amount        = Number(order.totalAmount).toFixed(2);
    const merchantOrderId = `ZC-${order.id}-${Date.now()}`;

    // Token expiry — 1 hour from now, format: yyyyMMddHHmmss
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    const pad    = (n) => String(n).padStart(2, '0');
    const expiryStr = `${expiry.getFullYear()}${pad(expiry.getMonth() + 1)}${pad(expiry.getDate())}${pad(expiry.getHours())}${pad(expiry.getMinutes())}${pad(expiry.getSeconds())}`;

    const postBackURL = process.env.EASYPAISA_CALLBACK_URL ||
      `${req.protocol}://${req.get('host')}/api/payments/easypaisa/callback`;

    // Params for hash (alphabetical order)
    const hashParams = {
      amount,
      expiryDate:      expiryStr,
      merchantOrderId,
      orderDesc:       `Zouq Cafe Order #${order.id}`,
      postBackURL,
      storeId:         STORE_ID,
      tansactionType:  'InitialRequest',  // note: EasyPaisa typo in their docs
      tokenExpiry:     expiryStr,
    };

    const hash = generateHash(hashParams);

    // Save pending payment record
    await prisma.payment.upsert({
      where:  { orderId: order.id },
      update: { transactionId: merchantOrderId, status: 'PENDING' },
      create: {
        orderId:       order.id,
        method:        'ONLINE',
        transactionId: merchantOrderId,
        status:        'PENDING',
      },
    });

    // Build the redirect URL — customer POSTs a form to this URL
    // We return all params so frontend can build an auto-submit form
    return success(res, {
      gatewayUrl:     GATEWAY_URL,
      storeId:        STORE_ID,
      amount,
      orderDesc:      hashParams.orderDesc,
      merchantOrderId,
      expiryDate:     expiryStr,
      tokenExpiry:    expiryStr,
      tansactionType: 'InitialRequest',
      postBackURL,
      hash,
      successUrl:     `${process.env.CLIENT_URL}/payment/success`,
      failureUrl:     `${process.env.CLIENT_URL}/payment/failed`,
    });
  } catch (err) {
    console.error('[initiatePayment]', err);
    return error(res, 'Failed to initiate payment.', 500);
  }
};

// ─── POST /api/payments/easypaisa/callback ───────────────────────────────────
// EasyPaisa POSTs here after payment attempt (success or failure).
// IMPORTANT: Verify the hash before trusting the payload.
const easypaisaCallback = async (req, res) => {
  try {
    const {
      merchantOrderId,
      storeId,
      transactionId,   // EasyPaisa's own transaction ID
      transactionDateTime,
      paymentMethod,
      status,          // 'PAID' | 'UNPAID' | 'CANCEL' | 'REFUND'
      amount,
      hash: receivedHash,
    } = req.body;

    // ── Verify hash from EasyPaisa ──
    const verifyParams = {
      amount,
      merchantOrderId,
      paymentMethod: paymentMethod || '',
      status,
      storeId,
      tansactionType:      'InitialRequest',
      transactionDateTime: transactionDateTime || '',
      transactionId:       transactionId || '',
    };
    const expectedHash = generateHash(verifyParams);

    if (receivedHash && receivedHash.toUpperCase() !== expectedHash) {
      console.warn('[easypaisaCallback] Hash mismatch — possible tamper attempt', {
        received: receivedHash,
        expected: expectedHash,
      });
      return res.status(400).send('Hash verification failed');
    }

    // Find our internal payment record
    const payment = await prisma.payment.findFirst({
      where: { transactionId: merchantOrderId },
    });

    if (!payment) {
      console.warn('[easypaisaCallback] Unknown merchantOrderId:', merchantOrderId);
      return res.status(404).send('Transaction not found');
    }

    const isPaid = status === 'PAID';
    const paymentStatus = isPaid ? 'COMPLETED' : 'FAILED';

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data:  {
          status:        paymentStatus,
          transactionId: transactionId || payment.transactionId, // store EP's txn ID
        },
      }),
      // Auto-approve the order on successful payment
      ...(isPaid
        ? [prisma.order.update({
            where: { id: payment.orderId },
            data:  { status: 'APPROVED' },
          })]
        : []),
    ]);

    console.log(`[easypaisaCallback] Order #${payment.orderId} → ${paymentStatus}`);

    // EasyPaisa expects HTTP 200 OK
    return res.status(200).send('OK');
  } catch (err) {
    console.error('[easypaisaCallback]', err);
    return res.status(500).send('Internal Server Error');
  }
};

// ─── GET /api/payments/status/:orderId ───────────────────────────────────────
// Frontend polls this after returning from EasyPaisa to know if payment succeeded
const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payment = await prisma.payment.findFirst({
      where: { orderId: Number(orderId) },
      select: { status: true, transactionId: true, updatedAt: true },
    });

    if (!payment) return error(res, 'Payment record not found.', 404);

    return success(res, { status: payment.status, transactionId: payment.transactionId });
  } catch (err) {
    return error(res, 'Failed to fetch payment status.', 500);
  }
};

// ─── POST /api/payments/mock-complete (dev only) ──────────────────────────────
const mockComplete = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return error(res, 'Not available in production.', 403);
  }
  try {
    const { orderId } = req.body;
    const order = await prisma.order.findFirst({
      where: { id: Number(orderId), userId: req.user.id },
    });
    if (!order) return error(res, 'Order not found.', 404);

    await prisma.$transaction([
      prisma.payment.updateMany({
        where: { orderId: order.id },
        data:  { status: 'COMPLETED' },
      }),
      prisma.order.update({
        where: { id: order.id },
        data:  { status: 'APPROVED' },
      }),
    ]);

    return success(res, {}, 'Mock payment completed. Order approved.');
  } catch (err) {
    return error(res, 'Failed.', 500);
  }
};

module.exports = { initiatePayment, easypaisaCallback, getPaymentStatus, mockComplete };
