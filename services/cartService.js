import * as cartRepo from '../repositories/cartRepository.js';
import Product from '../model/Product.js';
import Coupon from '../model/Coupon.js';
import ErrorResponse from '../utils/errorResponse.js';

export const getCart = (userId, sessionId) => {
  if (userId) return cartRepo.findByUser(userId);
  if (sessionId) return cartRepo.findBySession(sessionId);
  return null;
};

export const addToCart = async (userId, sessionId, productId, quantity) => {
  const qty = Math.max(1, Math.floor(Number(quantity)));
  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new ErrorResponse('Product not found', 404);
  if (product.stock < qty) throw new ErrorResponse('Insufficient stock', 400);

  let cart = await getCart(userId, sessionId);
  const price = product.discountPrice > 0 ? product.discountPrice : product.price;

  if (cart) {
    const existingItem = cart.items.find(
      (i) => (i.product._id || i.product).toString() === productId
    );
    if (existingItem) {
      existingItem.quantity = Math.min(existingItem.quantity + qty, product.stock);
    } else {
      cart.items.push({ product: productId, quantity: qty, price });
    }
    await cart.save();
    return cart.populate('items.product');
  }

  const data = { items: [{ product: productId, quantity: qty, price }] };
  if (userId) {
    data.user = userId;
    return cartRepo.upsertForUser(userId, data);
  }
  data.sessionId = sessionId;
  return cartRepo.upsertForSession(sessionId, data);
};

export const updateCartItem = async (userId, sessionId, productId, quantity) => {
  const cart = await getCart(userId, sessionId);
  if (!cart) throw new ErrorResponse('Cart not found', 404);

  const item = cart.items.find((i) => (i.product._id || i.product).toString() === productId);
  if (!item) throw new ErrorResponse('Item not in cart', 404);

  const qty = Number(quantity);
  if (qty <= 0) {
    cart.items = cart.items.filter((i) => (i.product._id || i.product).toString() !== productId);
  } else {
    item.quantity = qty;
  }

  await cart.save();
  return cart.populate('items.product');
};

export const removeFromCart = async (userId, sessionId, productId) => {
  const cart = await getCart(userId, sessionId);
  if (!cart) throw new ErrorResponse('Cart not found', 404);
  cart.items = cart.items.filter((i) => (i.product._id || i.product).toString() !== productId);
  await cart.save();
  return cart.populate('items.product');
};

export const applyCoupon = async (userId, sessionId, code) => {
  const cart = await getCart(userId, sessionId);
  if (!cart) throw new ErrorResponse('Cart not found', 404);

  const normalizedCode = String(code).toUpperCase().trim();
  const coupon = await Coupon.findOne({
    code: normalizedCode,
    isActive: true,
    expiryDate: { $gt: new Date() },
  });
  if (!coupon) throw new ErrorResponse('Invalid or expired coupon', 400);

  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    throw new ErrorResponse('Coupon usage limit reached', 400);
  }

  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) {
    throw new ErrorResponse(`Minimum order amount is LKR ${coupon.minOrderAmount}`, 400);
  }

  let discount =
    coupon.discountType === 'percentage'
      ? (subtotal * coupon.discountValue) / 100
      : coupon.discountValue;

  if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);

  cart.coupon = coupon._id;
  cart.discount = Math.round(discount);
  await cart.save();
  return cart.populate('items.product coupon');
};

export const clearCart = async (userId, sessionId) => {
  const cart = await getCart(userId, sessionId);
  if (cart) {
    cart.items = [];
    cart.coupon = null;
    cart.discount = 0;
    await cart.save();
  }
};