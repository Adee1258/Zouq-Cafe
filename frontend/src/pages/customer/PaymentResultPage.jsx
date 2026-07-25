/**
 * PaymentResultPage
 *
 * EasyPaisa redirects customer back to:
 *   /payment/success  — after successful payment
 *   /payment/failed   — after failed/cancelled payment
 *
 * We poll GET /api/payments/status/:orderId to confirm the backend
 * also received the callback and marked the order APPROVED.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ReceiptText } from 'lucide-react';
import api from '../../lib/api';
import Button from '../../components/ui/Button';

// ─── Shared polling hook ──────────────────────────────────────────────────────
const usePaymentStatus = (orderId) => {
  const [status, setStatus] = useState('POLLING'); // POLLING | COMPLETED | FAILED | ERROR
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!orderId) { setStatus('ERROR'); return; }

    let cancelled = false;
    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS  = 2000;

    const poll = async () => {
      try {
        const res = await api.get(`/payments/status/${orderId}`);
        const s   = res.data?.data?.status;

        if (cancelled) return;

        if (s === 'COMPLETED') {
          setStatus('COMPLETED');
        } else if (s === 'FAILED') {
          setStatus('FAILED');
        } else if (attempts + 1 >= MAX_ATTEMPTS) {
          // Timed out — assume redirect URL is the source of truth
          setStatus('TIMEOUT');
        } else {
          setAttempts((a) => a + 1);
        }
      } catch {
        if (!cancelled) setStatus('ERROR');
      }
    };

    const timer = setTimeout(poll, INTERVAL_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [orderId, attempts]);

  return status;
};

// ─── Success Page ─────────────────────────────────────────────────────────────
export const PaymentSuccessPage = () => {
  const navigate  = useNavigate();
  const orderId   = sessionStorage.getItem('ep_pending_order');
  const pollStatus = usePaymentStatus(orderId);

  // Clean up session key once we're done
  useEffect(() => {
    return () => sessionStorage.removeItem('ep_pending_order');
  }, []);

  const confirmed = pollStatus === 'COMPLETED' || pollStatus === 'TIMEOUT';

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 px-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">

        {!confirmed ? (
          <>
            <Loader2 size={56} className="mx-auto text-orange-400 animate-spin mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Confirming Payment…</h1>
            <p className="text-gray-500 text-sm">Please wait while we verify your payment with EasyPaisa.</p>
          </>
        ) : (
          <>
            <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-500 text-sm mb-1">
              Your EasyPaisa payment has been received.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Order <span className="font-semibold text-gray-800">#{orderId}</span> is now confirmed and being prepared. 🎉
            </p>

            <div className="flex flex-col gap-3">
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate(`/orders/${orderId}`, { replace: true })}
              >
                <ReceiptText size={16} className="mr-2" />
                View My Order
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => navigate('/', { replace: true })}
              >
                Back to Home
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Failed Page ──────────────────────────────────────────────────────────────
export const PaymentFailedPage = () => {
  const navigate = useNavigate();
  const orderId  = sessionStorage.getItem('ep_pending_order');

  useEffect(() => {
    return () => sessionStorage.removeItem('ep_pending_order');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 px-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
        <XCircle size={64} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Payment Failed</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your EasyPaisa payment was not completed.{' '}
          {orderId && (
            <>
              Your order <span className="font-semibold text-gray-800">#{orderId}</span> is still saved — you can retry payment from your orders page.
            </>
          )}
        </p>

        <div className="flex flex-col gap-3">
          {orderId && (
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate(`/orders/${orderId}`, { replace: true })}
            >
              View Order & Retry
            </Button>
          )}
          <Button
            variant="ghost"
            fullWidth
            onClick={() => navigate('/', { replace: true })}
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};
