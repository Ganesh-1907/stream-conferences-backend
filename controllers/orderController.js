import { Order } from '../models/Order.js';
import { Registration } from '../models/Registration.js';
import { sendMail } from '../services/mail.js';
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  createMockSignature
} from '../services/razorpay.js';

const CATEGORY_PRICING = {
  'Student': 24500,
  'Academic': 39500,
  'Industry Delegate': 52000,
  'Virtual Attendee': 14500
};

export async function listOrders(req, res) {
  const { eventId, eventType } = req.query;
  try {
    const query = {};
    if (eventId) query.eventId = eventId;
    if (eventType) query.eventType = eventType;
    const list = await Order.find(query).sort({ createdAt: -1 });
    res.json(list);
  } catch (error) {
    console.error('Fetch orders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createOrder(req, res) {
  const { name, email, phone, category, amount, registrationId, eventId, eventType, eventTitle, eventSlug } = req.body;
  try {
    if (!name || !email || !category) {
      return res.status(400).json({ error: 'Missing required order fields (name, email, category)' });
    }

    const amountInPaisa = amount
      ? Math.round(Number(amount) * 100)
      : CATEGORY_PRICING[category] || 24500;

    const receipt = `reg_${Date.now()}`;
    const created = await createRazorpayOrder({
      amount: amountInPaisa,
      currency: 'INR',
      receipt
    });

    const order = await Order.create({
      orderId: created.id,
      name,
      email,
      phone,
      category,
      amount: amountInPaisa,
      currency: created.currency || 'INR',
      registrationId: registrationId || null,
      eventId: eventId || null,
      eventType: eventType || 'conference',
      eventTitle: eventTitle || null,
      eventSlug: eventSlug || null,
      status: 'pending',
      mode: created.mode
    });

    let mockSignature = null;
    if (created.mode === 'mock') {
      const mockPaymentId = `pay_mock_${Date.now()}`;
      mockSignature = createMockSignature({ orderId: created.id, paymentId: mockPaymentId });
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
        key: process.env.RAZORPAY_KEY_ID || null
      },
      mock: created.mode === 'mock' ? { paymentId: order.paymentId, signature: mockSignature } : null,
      orderRecordId: order._id
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
}

export async function verifyOrder(req, res) {
  const { orderId, paymentId, signature } = req.body;
  try {
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const valid = verifyRazorpaySignature({ orderId, paymentId, signature });
    if (!valid) {
      order.status = 'failed';
      await order.save();
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    order.paymentId = paymentId;
    order.signature = signature;
    order.status = 'paid';
    await order.save();

    // Sync the linked registration's payment status
    if (order.registrationId) {
      await Registration.updateOne({ _id: order.registrationId }, { paymentStatus: 'paid' });
    }

    if (order.email) {
      await sendMail({
        to: order.email,
        subject: `Payment confirmed${order.eventTitle ? ` — ${order.eventTitle}` : ''}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
            <h2 style="color: #0e7490;">Payment confirmed</h2>
            <p>Hi ${order.name},</p>
            <p>Your payment of <strong>₹${(order.amount / 100).toFixed(2)}</strong> has been received${order.eventTitle ? ` for <strong>${order.eventTitle}</strong>` : ''}.</p>
            <p>You are now fully registered. A confirmation email with event details will follow.</p>
          </div>
        `,
        text: `Hi ${order.name},\n\nYour payment of ₹${(order.amount / 100).toFixed(2)} has been received${order.eventTitle ? ` for ${order.eventTitle}` : ''}. You are now fully registered.\n`
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
