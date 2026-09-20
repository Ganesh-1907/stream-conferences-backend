import crypto from 'crypto';
import Razorpay from 'razorpay';

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

export const razorpayEnabled = Boolean(KEY_ID && KEY_SECRET);

export const razorpay = razorpayEnabled
  ? new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET })
  : null;

export function createRazorpayOrder({ amount, currency = 'USD', receipt }) {
  if (!razorpay) {
    const mockOrderId = `order_mock_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    return Promise.resolve({
      id: mockOrderId,
      amount,
      currency,
      receipt,
      mode: 'mock'
    });
  }
  return razorpay.orders.create({ amount, currency, receipt }).then((order) => ({
    ...order,
    mode: 'razorpay'
  }));
}

export function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', KEY_SECRET || 'mock-secret')
    .update(body)
    .digest('hex');
  return expected === signature;
}

export function createMockSignature({ orderId, paymentId }) {
  return crypto
    .createHmac('sha256', KEY_SECRET || 'mock-secret')
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}
