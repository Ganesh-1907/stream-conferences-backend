import Stripe from 'stripe';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;

export const stripeEnabled = Boolean(SECRET_KEY);
export const stripePublishableKey = PUBLISHABLE_KEY || null;

export const stripe = stripeEnabled ? new Stripe(SECRET_KEY) : null;

/**
 * Create a Stripe PaymentIntent for an order.
 * Falls back to a mock intent when no Stripe secret key is configured.
 */
export function createStripePaymentIntent({
  amount,
  currency = 'USD',
  orderId,
  description,
  receiptEmail,
  metadata = {}
}) {
  if (!stripe) {
    const mockId = `pi_mock_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    return Promise.resolve({
      id: mockId,
      clientSecret: `${mockId}_secret_mock`,
      amount,
      currency: String(currency).toLowerCase(),
      status: 'succeeded',
      mode: 'mock'
    });
  }

  return stripe.paymentIntents
    .create({
      amount,
      currency: String(currency).toLowerCase(),
      description,
      receipt_email: receiptEmail || undefined,
      metadata: { ...(orderId ? { orderId } : {}), ...metadata },
      automatic_payment_methods: { enabled: true }
    })
    .then((intent) => ({
      id: intent.id,
      clientSecret: intent.client_secret,
      amount: intent.amount,
      currency: intent.currency,
      status: intent.status,
      mode: 'stripe'
    }));
}

/**
 * Server-side verification: the PaymentIntent is re-read from Stripe so a
 * client can never mark its own order as paid.
 */
export async function verifyStripePayment({ orderId, paymentIntentId, expectedAmount }) {
  if (!stripe) {
    const ok = Boolean(paymentIntentId && String(paymentIntentId).startsWith('pi_mock_'));
    return { valid: ok, paymentId: paymentIntentId || null, reason: ok ? null : 'stripe_not_configured' };
  }

  if (!paymentIntentId) {
    return { valid: false, paymentId: null, reason: 'missing_payment_intent' };
  }

  let intent;
  try {
    intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (err) {
    if (err?.code === 'resource_missing') {
      return { valid: false, paymentId: paymentIntentId, reason: 'payment_intent_not_found' };
    }
    throw err;
  }

  if (!intent) {
    return { valid: false, paymentId: paymentIntentId, reason: 'payment_intent_not_found' };
  }

  const metaOrder = intent.metadata?.orderId;
  if (orderId && metaOrder && metaOrder !== orderId) {
    return { valid: false, paymentId: intent.id, reason: 'order_mismatch' };
  }
  if (expectedAmount && intent.amount !== expectedAmount) {
    return { valid: false, paymentId: intent.id, reason: 'amount_mismatch' };
  }
  if (intent.status !== 'succeeded') {
    return { valid: false, paymentId: intent.id, reason: `status_${intent.status}` };
  }

  return {
    valid: true,
    paymentId: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    reason: null
  };
}
