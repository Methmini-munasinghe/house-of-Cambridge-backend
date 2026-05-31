import Order from '../model/Order.js';
import Notification from '../model/Notification.js';
import ErrorResponse from '../utils/errorResponse.js';
import { verifyPayHereNotification, generatePayHereHash } from '../utils/payhereUtils.js';
import { createPayPalOrder, capturePayPalOrder } from '../utils/paypalUtils.js';
import axios from 'axios';

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const ALLOWED_CURRENCIES = Object.freeze(['LKR', 'USD', 'EUR', 'GBP']);

const PAYHERE_STATUS = Object.freeze({ SUCCESS: '2', FAILED: '-1', CANCELLED: '-2' });

const sanitiseOrderId = (id, next) => {
  if (!id || !OBJECT_ID_RE.test(id)) {
    next(new ErrorResponse('Invalid order ID', 400));
    return false;
  }
  return true;
};

const createPaymentNotification = async (order, message) => {
  if (!order.user) return;
  await Notification.create({
    user:    order.user,
    title:   'Payment Confirmed',
    message,
    type:    'order',
    link:    `/track-order/${order._id}`,
  });
};

export const getPayHereHash = async (req, res, next) => {
  try {
    const { orderId, amount, currency = 'LKR' } = req.body;

    if (!sanitiseOrderId(orderId, next)) return;

    if (!ALLOWED_CURRENCIES.includes(currency)) {
      return next(new ErrorResponse('Unsupported currency', 400));
    }

    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return next(new ErrorResponse('Invalid amount', 400));
    }

    const order = await Order.findById(orderId).select('orderNumber').lean();
    if (!order) return next(new ErrorResponse('Order not found', 404));

    const hash = generatePayHereHash(
      process.env.PAYHERE_MERCHANT_ID,
      order.orderNumber,
      parsedAmount,
      currency,
      process.env.PAYHERE_MERCHANT_SECRET,
    );

    return res.json({ success: true, hash, merchantId: process.env.PAYHERE_MERCHANT_ID });
  } catch (err) {
    return next(err);
  }
};

export const payHereNotify = async (req, res) => {
  try {
    const data = req.body;

    const valid = verifyPayHereNotification(data, process.env.PAYHERE_MERCHANT_SECRET);
    if (!valid) return res.status(400).send('Invalid signature');

    if (!data.order_id || typeof data.order_id !== 'string') {
      return res.status(400).send('Missing order_id');
    }

    const order = await Order.findOne({ orderNumber: data.order_id }).select(
      'user orderNumber paymentStatus orderStatus paymentId',
    );
    if (!order) return res.status(404).send('Order not found');

    if (data.status_code === PAYHERE_STATUS.SUCCESS) {
      order.paymentStatus = 'paid';
      order.orderStatus   = 'confirmed';
      order.paymentId     = data.payment_id;
      await order.save();
      await createPaymentNotification(
        order,
        `Payment for order #${order.orderNumber} was successful.`,
      );
    } else if (
      data.status_code === PAYHERE_STATUS.FAILED ||
      data.status_code === PAYHERE_STATUS.CANCELLED
    ) {
      order.paymentStatus = 'failed';
      await order.save();
    }

    return res.send('OK');
  } catch (err) {
    return res.status(500).send('Error');
  }
};

export const createPayPalPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!sanitiseOrderId(orderId, next)) return;

    const order = await Order.findById(orderId).select('total').lean();
    if (!order) return next(new ErrorResponse('Order not found', 404));

    if (!Number.isFinite(order.total) || order.total <= 0) {
      return next(new ErrorResponse('Order total is invalid', 422));
    }

    const paypalOrder = await createPayPalOrder(order.total, 'USD');
    return res.json({ success: true, paypalOrderId: paypalOrder.id });
  } catch (err) {
    return next(err);
  }
};

export const capturePayPalPayment = async (req, res, next) => {
  try {
    const { paypalOrderId, orderId } = req.body;

    if (!orderId || !OBJECT_ID_RE.test(orderId)) {
      return next(new ErrorResponse('Invalid order ID', 400));
    }

    if (!paypalOrderId || typeof paypalOrderId !== 'string' || paypalOrderId.length > 64) {
      return next(new ErrorResponse('Invalid PayPal order ID', 400));
    }

    const capture = await capturePayPalOrder(paypalOrderId);
    if (capture.status !== 'COMPLETED') {
      return next(new ErrorResponse('PayPal capture failed', 400));
    }

    const order = await Order.findById(orderId).select(
      'user orderNumber paymentStatus orderStatus paymentId',
    );
    if (!order) return next(new ErrorResponse('Order not found', 404));

    order.paymentStatus = 'paid';
    order.orderStatus   = 'confirmed';
    order.paymentId     = paypalOrderId;
    await order.save();

    await createPaymentNotification(
      order,
      `PayPal payment for order #${order.orderNumber} was successful.`,
    );

    return res.json({ success: true, order });
  } catch (err) {
    return next(err);
  }
};

export const initiateKoko = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    if (!sanitiseOrderId(orderId, next)) return;

    const order = await Order.findById(orderId).select('orderNumber total _id').lean();
    if (!order) return next(new ErrorResponse('Order not found', 404));

    const kokoRes = await axios.post(
      'https://api.koko.lk/v1/orders',
      {
        merchant_id: process.env.KOKO_MERCHANT_ID,
        order_id:    order.orderNumber,
        amount:      order.total,
        currency:    'LKR',
        notify_url:  process.env.KOKO_NOTIFY_URL,
        return_url:  `${process.env.CLIENT_URL}/order-confirmation/${order._id}`,
        cancel_url:  `${process.env.CLIENT_URL}/payment-denied`,
      },
      { headers: { Authorization: `Bearer ${process.env.KOKO_API_KEY}` } },
    );

    if (!kokoRes.data?.checkout_url) {
      return next(new ErrorResponse('KOKO did not return a checkout URL', 502));
    }

    return res.json({ success: true, redirectUrl: kokoRes.data.checkout_url });
  } catch (err) {
    return next(err);
  }
};

export const kokoNotify = async (req, res) => {
  try {
    const { order_id, status } = req.body;

    if (!order_id || typeof order_id !== 'string') {
      return res.status(400).send('Missing order_id');
    }

    const order = await Order.findOne({ orderNumber: order_id }).select(
      'paymentStatus orderStatus',
    );
    if (!order) return res.status(404).send('Not found');

    if (status === 'SUCCESS') {
      order.paymentStatus = 'paid';
      order.orderStatus   = 'confirmed';
      await order.save();
    }

    return res.send('OK');
  } catch (err) {
    return res.status(500).send('Error');
  }
};