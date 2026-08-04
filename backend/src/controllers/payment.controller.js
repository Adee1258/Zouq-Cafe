/**
 * Payment Controller — Manual EasyPaisa Screenshot Verification
 *
 * Flow:
 *  1. Customer places order with paymentType=ONLINE
 *  2. System shows EasyPaisa number (from AppConfig)
 *  3. Customer sends money to that number, then uploads screenshot
 *  4. Admin sees screenshot in order detail, clicks Verify or Reject
 *  5. On Verify → payment COMPLETED, order APPROVED
 *  6. On Reject → payment FAILED, admin can add note
 *
 * Endpoints:
 *  GET  /api/payments/easypaisa-number          — public: get the configured number
 *  POST /api/payments/screenshot/:orderId       — customer: upload screenshot
 *  GET  /api/payments/status/:orderId           — customer: poll payment status
 *  POST /api/payments/admin/verify/:orderId     — admin: verify payment
 *  POST /api/payments/admin/reject/:orderId     — admin: reject payment
 *  GET  /api/payments/admin/pending             — admin: list pending online payments
 *  PATCH /api/payments/admin/easypaisa-number   — admin: update EasyPaisa number
 */

const prisma   = require('../config/prisma');
const { success, error } = require('../utils/response');
const { getIO } = require('../config/socket');
const cloudinary = require('../config/cloudinary');

const EP_NUMBER_KEY = 'easypaisa_number';
const EP_NAME_KEY   = 'easypaisa_account_name';

// ─── GET /api/payments/easypaisa-number ──────────────────────────────────────
const getEasypaisaNumber = async (req, res) => {
  try {
    const [numRow, nameRow] = await Promise.all([
      prisma.appConfig.findUnique({ where: { key: EP_NUMBER_KEY } }),
      prisma.appConfig.findUnique({ where: { key: EP_NAME_KEY } }),
    ]);
    return success(res, {
      number:      numRow?.value  || null,
      accountName: nameRow?.value || 'ZOCK Cafe',
    });
  } catch (err) {
    console.error('[getEasypaisaNumber]', err);
    return error(res, 'Failed to fetch EasyPaisa number.', 500);
  }
};

// ─── PATCH /api/payments/admin/easypaisa-number ───────────────────────────────
const updateEasypaisaNumber = async (req, res) => {
  try {
    const { number, accountName } = req.body;
    if (!number || !number.trim()) return error(res, 'EasyPaisa number is required.', 400);

    await Promise.all([
      prisma.appConfig.upsert({
        where:  { key: EP_NUMBER_KEY },
        update: { value: number.trim() },
        create: { key: EP_NUMBER_KEY, value: number.trim() },
      }),
      accountName && prisma.appConfig.upsert({
        where:  { key: EP_NAME_KEY },
        update: { value: accountName.trim() },
        create: { key: EP_NAME_KEY, value: accountName.trim() },
      }),
    ].filter(Boolean));

    return success(res, {}, 'EasyPaisa number updated.');
  } catch (err) {
    console.error('[updateEasypaisaNumber]', err);
    return error(res, 'Failed to update EasyPaisa number.', 500);
  }
};

// ─── POST /api/payments/screenshot/:orderId ───────────────────────────────────
// Customer uploads payment screenshot after sending money
const uploadScreenshot = async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const userId  = req.user.id;

    // Verify this order belongs to the user and is ONLINE payment
    const order = await prisma.order.findFirst({
      where:   { id: orderId, userId },
      include: { payment: true },
    });
    if (!order)                         return error(res, 'Order not found.', 404);
    if (order.paymentType !== 'ONLINE') return error(res, 'This order is Cash on Delivery.', 400);
    if (order.payment?.status === 'COMPLETED')
      return error(res, 'Payment already verified.', 400);
    if (!req.file) return error(res, 'Screenshot image is required.', 400);

    const screenshotUrl = req.file.path; // Cloudinary URL

    // Upsert payment record with screenshot
    await prisma.payment.upsert({
      where:  { orderId },
      update: { screenshotUrl, status: 'PENDING', rejectedAt: null, adminNote: null },
      create: {
        orderId,
        method:        'ONLINE',
        status:        'PENDING',
        screenshotUrl,
      },
    });

    // Notify admin in real-time
    try {
      getIO().to('admin').emit('payment_screenshot_uploaded', {
        orderId,
        userId,
        screenshotUrl,
      });
    } catch { /* socket not critical */ }

    return success(res, { screenshotUrl }, 'Screenshot uploaded. Awaiting admin verification.');
  } catch (err) {
    console.error('[uploadScreenshot]', err);
    return error(res, 'Failed to upload screenshot.', 500);
  }
};

// ─── GET /api/payments/status/:orderId ────────────────────────────────────────
const getPaymentStatus = async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const payment = await prisma.payment.findFirst({
      where:  { orderId },
      select: { status: true, screenshotUrl: true, adminNote: true, verifiedAt: true, rejectedAt: true },
    });
    if (!payment) return success(res, { status: 'NOT_FOUND', screenshotUrl: null });
    return success(res, payment);
  } catch (err) {
    return error(res, 'Failed to fetch payment status.', 500);
  }
};

// ─── POST /api/payments/admin/verify/:orderId ────────────────────────────────
// Admin confirms payment received → COMPLETED + order APPROVED
const adminVerify = async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    if (!payment) return error(res, 'Payment record not found.', 404);
    if (payment.status === 'COMPLETED') return error(res, 'Already verified.', 400);

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data:  { status: 'COMPLETED', verifiedAt: new Date(), adminNote: null },
      }),
      prisma.order.update({
        where: { id: orderId },
        data:  { status: 'APPROVED' },
      }),
    ]);

    // Notify customer
    try {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true } });
      if (order) {
        getIO().to(`user_${order.userId}`).emit('payment_verified', { orderId });
        getIO().to(`user_${order.userId}`).emit('order_status_updated', { id: orderId, status: 'APPROVED' });
      }
    } catch { /* socket not critical */ }

    return success(res, {}, 'Payment verified. Order approved.');
  } catch (err) {
    console.error('[adminVerify]', err);
    return error(res, 'Failed to verify payment.', 500);
  }
};

// ─── POST /api/payments/admin/reject/:orderId ────────────────────────────────
// Admin rejects payment — order stays PENDING, customer can re-upload
const adminReject = async (req, res) => {
  try {
    const orderId  = Number(req.params.orderId);
    const { note } = req.body;

    const payment = await prisma.payment.findFirst({ where: { orderId } });
    if (!payment) return error(res, 'Payment record not found.', 404);

    await prisma.payment.update({
      where: { id: payment.id },
      data:  {
        status:       'FAILED',
        rejectedAt:   new Date(),
        adminNote:    note?.trim() || 'Payment could not be verified. Please re-upload.',
        screenshotUrl: null, // clear so customer can re-upload
      },
    });

    // Notify customer
    try {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { userId: true } });
      if (order) {
        getIO().to(`user_${order.userId}`).emit('payment_rejected', {
          orderId,
          note: note?.trim() || 'Payment could not be verified. Please re-upload.',
        });
      }
    } catch { /* socket not critical */ }

    return success(res, {}, 'Payment rejected.');
  } catch (err) {
    console.error('[adminReject]', err);
    return error(res, 'Failed to reject payment.', 500);
  }
};

// ─── GET /api/payments/admin/pending ─────────────────────────────────────────
// Admin: list all orders with pending online payments (screenshot uploaded, not yet verified)
const adminGetPending = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: {
        method: 'ONLINE',
        status: 'PENDING',
        screenshotUrl: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true, totalAmount: true, status: true, createdAt: true,
            user: { select: { id: true, name: true, phone: true, email: true } },
          },
        },
      },
    });
    return success(res, { payments });
  } catch (err) {
    console.error('[adminGetPending]', err);
    return error(res, 'Failed to fetch pending payments.', 500);
  }
};

module.exports = {
  getEasypaisaNumber,
  updateEasypaisaNumber,
  uploadScreenshot,
  getPaymentStatus,
  adminVerify,
  adminReject,
  adminGetPending,
};
