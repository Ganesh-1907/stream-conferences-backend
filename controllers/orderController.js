import { Order } from '../models/Order.js';
import { Registration } from '../models/Registration.js';
import { Conference } from '../models/Conference.js';
import { sendMail } from '../services/mail.js';
import { emailTemplate } from '../services/emailTemplates.js';
import { generateRegistrationPDF } from '../services/pdfGenerator.js';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  createMockSignature
} from '../services/razorpay.js';
import {
  createStripePaymentIntent,
  verifyStripePayment,
  stripePublishableKey
} from '../services/stripe.js';

const CATEGORY_PRICING = {
  'Student': 24500,
  'Academic': 39500,
  'Industry Delegate': 52000,
  'Virtual Attendee': 14500
};

const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹' };

/** Fetch the full event document for email branding. */
async function fetchFullEvent(eventId, eventType) {
  if (!eventId) return null;
  return Conference.findById(eventId).lean();
}

export async function listOrders(req, res) {
  const { eventId, eventType, cohortId } = req.query;
  try {
    const query = {};
    if (eventId) query.eventId = eventId;
    if (eventType) query.eventType = eventType;
    if (cohortId) query.cohortId = cohortId;
    const list = await Order.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createOrder(req, res) {
  const { title, fullName, name, email, phone, address, country, category, amount, currency, registrationId, eventId, eventType, eventTitle, eventSlug, cohortId } = req.body;
  try {
    const finalFullName = fullName || name;
    if (!finalFullName || !email || !category) {
      return res.status(400).json({ error: 'Missing required order fields (name, email, category)' });
    }

    const gateway =
      String(req.body.gateway || req.body.paymentGateway || 'razorpay').toLowerCase() === 'stripe'
        ? 'stripe'
        : 'razorpay';

    const orderCurrency = (currency || 'USD').toUpperCase();
    const amountInSubunit = amount
      ? Math.round(Number(amount) * 100)
      : (CATEGORY_PRICING[category] || 24500);

    const receipt = `reg_${Date.now()}`;
    const displayName = title ? `${title} ${finalFullName}`.trim() : finalFullName;

    let created;
    let orderId;
    if (gateway === 'stripe') {
      orderId = `order_stripe_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      created = await createStripePaymentIntent({
        amount: amountInSubunit,
        currency: orderCurrency,
        orderId,
        description: `${eventTitle || 'Event registration'} — ${category}`,
        receiptEmail: email,
        customerName: displayName,
        customerAddress: address || undefined,
        customerCountry: country || undefined,
        metadata: {
          registrationId: registrationId || '',
          eventId: eventId || '',
          eventType: eventType || 'conference'
        }
      });
    } else {
      created = await createRazorpayOrder({
        amount: amountInSubunit,
        currency: orderCurrency,
        receipt
      });
      orderId = created.id;
    }

    const order = await Order.create({
      orderId,
      title,
      fullName: finalFullName,
      name: displayName,
      email,
      phone,
      address,
      country: country || null,
      category,
      amount: amountInSubunit,
      currency: (created.currency || orderCurrency).toUpperCase(),
      originalCurrency: orderCurrency,
      originalAmount: amountInSubunit,
      registrationId: registrationId || null,
      eventId: eventId || null,
      eventType: eventType || 'conference',
      eventTitle: eventTitle || null,
      eventSlug: eventSlug || null,
      cohortId: cohortId || null,
      status: 'pending',
      mode: created.mode,
      ...(created.mode === 'stripe' ? { paymentId: created.id } : {})
    });

    let mockSignature = null;
    if (created.mode === 'mock') {
      const mockPaymentId = `pay_mock_${Date.now()}`;
      mockSignature = createMockSignature({ orderId: order.orderId, paymentId: mockPaymentId });
      order.paymentId = mockPaymentId;
      order.signature = mockSignature;
      await order.save();
    }

    res.status(201).json({
      order: {
        id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        receipt,
        mode: created.mode,
        gateway,
        key: created.mode === 'stripe'
          ? (stripePublishableKey || null)
          : (process.env.RAZORPAY_KEY_ID || null),
        clientSecret: created.clientSecret || null
      },
      mock: created.mode === 'mock' ? { paymentId: order.paymentId, signature: mockSignature } : null,
      orderRecordId: order._id
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
}

/** Map a Stripe verification reason to a client-facing message. */
function stripeVerifyError(reason) {
  if (reason === 'amount_mismatch') return 'Payment amount verification failed';
  if (reason === 'order_mismatch') return 'Payment does not match this order';
  if (reason === 'payment_intent_not_found') return 'Payment session not found';
  if (reason === 'missing_payment_intent') return 'Missing payment reference';
  if (reason === 'stripe_not_configured') return 'Stripe is not configured on the server';
  if (typeof reason === 'string' && reason.startsWith('status_')) {
    return `Payment not completed (${reason.slice('status_'.length)})`;
  }
  return 'Payment verification failed';
}

export async function verifyOrder(req, res) {
  const { orderId, paymentId, signature } = req.body;
  try {
    if (!orderId) {
      return res.status(400).json({ error: 'Missing order reference (orderId)' });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    let valid = false;
    let finalPaymentId = paymentId || order.paymentId || null;
    let finalSignature = signature || null;
    let failMessage = 'Payment signature verification failed';

    if (order.mode === 'stripe') {
      const result = await verifyStripePayment({
        orderId: order.orderId,
        paymentIntentId: order.paymentId || paymentId || null,
        expectedAmount: order.amount
      });
      valid = result.valid;
      if (result.paymentId) finalPaymentId = result.paymentId;
      finalSignature = null;
      if (!valid) failMessage = stripeVerifyError(result.reason);
    } else if (order.mode === 'mock') {
      if (!paymentId || !signature) {
        failMessage = 'Missing payment verification fields';
      } else {
        const matchesStored = !order.paymentId || order.paymentId === paymentId;
        valid = createMockSignature({ orderId, paymentId }) === signature && matchesStored;
      }
    } else {
      if (!paymentId || !signature) {
        failMessage = 'Missing payment verification fields';
      } else {
        valid = verifyRazorpaySignature({ orderId, paymentId, signature });
      }
    }

    if (!valid) {
      order.status = 'failed';
      await order.save();
      return res.status(400).json({ error: failMessage });
    }

    order.paymentId = finalPaymentId;
    if (finalSignature) order.signature = finalSignature;
    order.status = 'paid';
    await order.save();

    // Sync the linked registration's payment status
    let registration = null;
    if (order.registrationId) {
      registration = await Registration.findByIdAndUpdate(
        order.registrationId,
        { paymentStatus: 'paid' },
        { new: true }
      ).lean();
    }

    if (order.email) {
      const fullEvent = await fetchFullEvent(order.eventId, order.eventType);

      // Format currency symbol for receipt
      const curSym = CURRENCY_SYMBOLS[order.currency?.toUpperCase()] || '$';
      const displayTotal = `${curSym}${(order.amount / 100).toFixed(2)} ${order.currency || 'USD'}`;

      // Generate PDF receipt
      let pdfBuffer = null;
      try {
        pdfBuffer = await generateRegistrationPDF({ registration, order, event: fullEvent });
      } catch (pdfErr) {
        console.error('[PDF] Generation failed, sending email without attachment:', pdfErr);
      }

      const attachments = pdfBuffer
        ? [{ filename: `Registration-Confirmation-${order.name?.replace(/\s+/g, '-') || 'receipt'}.pdf`, content: pdfBuffer }]
        : [];

      await sendMail({
        to: order.email,
        subject: `Payment confirmed — ${order.eventTitle || 'Stream Conferences'}`,
        html: emailTemplate({
          heading: 'Payment confirmed',
          event: fullEvent,
          preheader: `Your payment of ${displayTotal} for ${order.eventTitle || 'the event'} has been received.`,
          body: `
            <p>Hi ${order.name},</p>
            <p>Your payment of <strong>${displayTotal}</strong> has been received for <strong>${order.eventTitle || 'the event'}</strong>.</p>
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px; margin:18px 0; font-size:14px;">
              <div><strong style="color:#0e7490;">Category:</strong> ${order.category || '—'}</div>
              <div><strong style="color:#0e7490;">Payment ID:</strong> ${finalPaymentId}</div>
              <div><strong style="color:#0e7490;">Order ID:</strong> ${orderId}</div>
            </div>
            <p>You are now fully registered. Please find your registration confirmation attached as a PDF.</p>
            <p style="color:#64748b; font-size:13px;">This email serves as your payment receipt. Please keep it for your records.</p>
          `,
          footerText: `Thank you for registering. We look forward to seeing you at the event.`,
        }),
        text: `Hi ${order.name},\n\nYour payment of ${displayTotal} has been received for ${order.eventTitle || 'the event'}.\n\nCategory: ${order.category}\nPayment ID: ${finalPaymentId}\nOrder ID: ${orderId}\n\nYou are now fully registered. Your registration confirmation PDF is attached.\n`,
        attachments
      });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Verify order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function orderStatus(req, res) {
  const { id } = req.params;
  try {
    const order = await Order.findOne({ orderId: id });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Order status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
