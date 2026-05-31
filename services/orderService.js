import User from '../model/User.js';
import Product from '../model/Product.js';
import Notification from '../model/Notification.js';
import ErrorResponse from '../utils/errorResponse.js';
import sendEmail from '../utils/sendEmail.js';
import * as orderRepo from '../repositories/orderRepository.js';
import * as cartService from './cartService.js';
import { calcShipping, calcTotalWeightKg } from '../utils/shippingUtils.js';

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const TAX_RATE          = 0.08;
const LOYALTY_EARN_RATE = 50;
const MAX_LOYALTY_REDEEM_RATIO = 0.25;

const ALLOWED_PAYMENT_METHODS = Object.freeze(['card', 'paypal', 'koko', 'cod']);
const ALLOWED_SHIPPING_METHODS = Object.freeze(['courier', 'express', 'pickup']);
const ALLOWED_STATUSES = Object.freeze([
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded',
]);
const ADMIN_ROLES = Object.freeze(['admin', 'superadmin']);

const sanitiseAddress = (addr) => {
  if (!addr || typeof addr !== 'object' || Array.isArray(addr)) {
    throw new ErrorResponse('Shipping address is required', 400);
  }
  const required = ['fullName', 'addressLine1', 'city', 'postalCode', 'country'];
  for (const field of required) {
    if (!addr[field] || typeof addr[field] !== 'string' || !addr[field].trim()) {
      throw new ErrorResponse(`Shipping address is missing required field: ${field}`, 400);
    }
  }
  return {
    fullName:     addr.fullName.trim().slice(0, 100),
    addressLine1: addr.addressLine1.trim().slice(0, 200),
    addressLine2: typeof addr.addressLine2 === 'string' ? addr.addressLine2.trim().slice(0, 200) : '',
    city:         addr.city.trim().slice(0, 100),
    postalCode:   addr.postalCode.trim().slice(0, 20),
    country:      addr.country.trim().slice(0, 100),
    phone:        typeof addr.phone === 'string' ? addr.phone.trim().slice(0, 20) : '',
  };
};

const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const createOrder = async (userId, sessionId, orderData) => {
  if (!orderData || typeof orderData !== 'object' || Array.isArray(orderData)) {
    throw new ErrorResponse('Invalid order payload', 400);
  }

  const cart = await cartService.getCart(userId, sessionId);
  if (!cart?.items?.length) throw new ErrorResponse('Cart is empty', 400);

  const paymentMethod = ALLOWED_PAYMENT_METHODS.includes(orderData.paymentMethod)
    ? orderData.paymentMethod
    : 'card';

  const shippingMethod = ALLOWED_SHIPPING_METHODS.includes(orderData.shippingMethod)
    ? orderData.shippingMethod
    : 'courier';

  const shippingAddress = sanitiseAddress(orderData.shippingAddress);

  const productIds = cart.items.map((i) => i.product._id ?? i.product);
  const products   = await Product.find({ _id: { $in: productIds } })
    .select('_id name stock isActive')
    .lean();

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  for (const item of cart.items) {
    const pid     = (item.product._id ?? item.product).toString();
    const product = productMap.get(pid);
    if (!product || !product.isActive) {
      throw new ErrorResponse('One or more products are no longer available', 400);
    }
    if (product.stock < item.quantity) {
      throw new ErrorResponse(`Insufficient stock for "${escapeHtml(product.name)}"`, 400);
    }
  }

  const totalWeightKg = calcTotalWeightKg(cart.items);
  const shippingCost  = calcShipping(shippingMethod, totalWeightKg);
  const subtotal      = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const discount      = Number.isFinite(cart.discount) ? cart.discount : 0;

  const rawLoyaltyUsed = parseInt(orderData.loyaltyPointsUsed, 10) || 0;
  const maxLoyaltyDiscount = Math.floor(subtotal * MAX_LOYALTY_REDEEM_RATIO);
  const loyaltyDiscount = Math.min(Math.max(0, rawLoyaltyUsed), maxLoyaltyDiscount);

  const taxable  = Math.max(0, subtotal - discount - loyaltyDiscount);
  const tax      = Math.round(taxable * TAX_RATE);
  const total    = taxable + shippingCost + tax;

  const loyaltyPointsEarned = Math.floor(total / LOYALTY_EARN_RATE);

  const guestEmail = typeof orderData.guestEmail === 'string'
    ? orderData.guestEmail.trim().slice(0, 254)
    : '';
  const guestName  = typeof orderData.guestName === 'string'
    ? orderData.guestName.trim().slice(0, 100)
    : '';
  const notes      = typeof (orderData.notes ?? orderData.orderNotes) === 'string'
    ? (orderData.notes ?? orderData.orderNotes).trim().slice(0, 500)
    : '';

  const order = await orderRepo.create({
    user:          userId ?? null,
    guestEmail,
    guestName,
    items: cart.items.map((i) => ({
      product:  i.product._id ?? i.product,
      name:     typeof i.product.name === 'string' ? i.product.name.slice(0, 200) : '',
      image:    typeof i.product.images?.[0]?.url === 'string' ? i.product.images[0].url : '',
      price:    i.price,
      quantity: i.quantity,
    })),
    shippingAddress,
    paymentMethod,
    paymentStatus:        'pending',
    shippingMethod,
    subtotal,
    shippingCost,
    discount,
    tax,
    total,
    coupon:               cart.coupon?.code ?? '',
    loyaltyPointsUsed:    loyaltyDiscount,
    loyaltyPointsEarned,
    notes,
  });

  await Promise.allSettled(
    cart.items.map((item) =>
      Product.findByIdAndUpdate(
        item.product._id ?? item.product,
        { $inc: { stock: -item.quantity } },
      ),
    ),
  );

  if (userId) {
    const pointsDelta = loyaltyPointsEarned - loyaltyDiscount;
    await Promise.allSettled([
      User.findByIdAndUpdate(userId, { $inc: { loyaltyPoints: pointsDelta } }),
      Notification.create({
        user:    userId,
        title:   'Order Placed Successfully',
        message: `Your order #${order.orderNumber} has been placed. You earned ${loyaltyPointsEarned} loyalty points!`,
        type:    'order',
        link:    `/track-order/${order._id}`,
      }),
    ]);
  }

  await cartService.clearCart(userId, sessionId);

  let emailTo = guestEmail || null;
  if (!emailTo && userId) {
    const user = await User.findById(userId).select('email').lean();
    emailTo = user?.email ?? null;
  }

  if (emailTo) {
    sendEmail({
      to:      emailTo,
      subject: `Order Received – ${order.orderNumber} | House of Cambridge`,
      html:    buildOrderEmail(order),
    }).catch(() => {});
  }

  return order;
};

export const getOrderById = async (id, userId, role) => {
  if (!OBJECT_ID_RE.test(id)) throw new ErrorResponse('Invalid order ID', 400);

  const order = await orderRepo.findById(id);
  if (!order) throw new ErrorResponse('Order not found', 404);

  if (!ADMIN_ROLES.includes(role)) {
    if (!userId || order.user?.toString() !== userId.toString()) {
      throw new ErrorResponse('Access denied', 403);
    }
  }

  return order;
};

export const getUserOrders = (userId, options = {}) =>
  orderRepo.findByUser(userId, options);

export const updateOrderStatus = async (id, status, adminNote) => {
  if (!OBJECT_ID_RE.test(id)) throw new ErrorResponse('Invalid order ID', 400);

  if (!ALLOWED_STATUSES.includes(status)) {
    throw new ErrorResponse(`Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}`, 400);
  }

  const sanitisedNote = typeof adminNote === 'string'
    ? adminNote.trim().slice(0, 500)
    : undefined;

  const updateData = {
    orderStatus: status,
    ...(status === 'delivered' && { deliveredAt: Date.now(), paymentStatus: 'paid' }),
    ...(status === 'cancelled' && { cancelledAt: Date.now() }),
    ...(sanitisedNote          && { adminNotes:  sanitisedNote }),
  };

  const order = await orderRepo.update(id, updateData);
  if (!order) throw new ErrorResponse('Order not found', 404);

  if (order.user) {
    Notification.create({
      user:    order.user,
      title:   'Order Status Updated',
      message: `Your order #${order.orderNumber} is now: ${status.replace(/_/g, ' ')}.`,
      type:    'order',
      link:    `/track-order/${order._id}`,
    }).catch(() => {});
  }

  return order;
};

const buildOrderEmail = (order) => {
  const rows = order.items.map((i) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0">${escapeHtml(i.name)}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:center">${i.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:right">Rs.${Number(i.price).toLocaleString()}</td>
    </tr>`).join('');

  const paymentNote = order.paymentMethod === 'cod'
    ? '<p style="color:#856404;background:#fff3cd;padding:10px;border-radius:6px;font-size:13px">&#x1F4B5; Cash on Delivery &mdash; please have the exact amount ready when your order arrives.</p>'
    : '<p style="color:#0f5132;background:#d1e7dd;padding:10px;border-radius:6px;font-size:13px">&#x1F512; Your payment is being processed securely. You will receive a confirmation once it clears.</p>';

  const discountRow = order.discount > 0
    ? `<tr><td>Discount</td><td align="right" style="color:green">-Rs.${order.discount.toLocaleString()}</td></tr>`
    : '';

  return `
<div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;color:#1A1A1A">
  <div style="background:#FFB700;padding:24px;text-align:center">
    <h1 style="margin:0;font-size:22px;color:#000">Order Received!</h1>
  </div>
  <div style="padding:24px;background:#fff;border:1px solid #e9e9e9">
    <p>Your order <strong>${escapeHtml(order.orderNumber)}</strong> has been placed successfully.</p>
    ${paymentNote}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
      <thead>
        <tr style="background:#f8f8f8">
          <th style="padding:8px;text-align:left">Product</th>
          <th style="padding:8px;text-align:center">Qty</th>
          <th style="padding:8px;text-align:right">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <table width="100%" cellpadding="4" cellspacing="0">
      <tr><td>Subtotal</td><td align="right">Rs.${order.subtotal.toLocaleString()}</td></tr>
      ${discountRow}
      <tr><td>Shipping</td><td align="right">${order.shippingCost > 0 ? `Rs.${order.shippingCost.toLocaleString()}` : 'Free'}</td></tr>
      <tr><td>Tax (VAT 8%)</td><td align="right">Rs.${order.tax.toLocaleString()}</td></tr>
      <tr style="font-weight:bold;font-size:16px;border-top:2px solid #1A1A1A">
        <td>Total</td><td align="right">Rs.${order.total.toLocaleString()}</td>
      </tr>
    </table>
  </div>
  <div style="padding:16px;background:#f8f8f8;text-align:center;font-size:12px;color:#60717B">
    House of Cambridge &middot; houseofcambridge.co.uk
  </div>
</div>`;
};