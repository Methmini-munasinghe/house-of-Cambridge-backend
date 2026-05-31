import * as cartService from '../services/cartService.js';
import ErrorResponse from '../utils/errorResponse.js';

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const COUPON_RE    = /^[a-zA-Z0-9_\-]{1,32}$/;

const EMPTY_CART = Object.freeze({ items: [], discount: 0, coupon: null });

const getIdentifiers = (req) => ({
  userId:    req.user?._id ?? null,
  sessionId: req.cookies?.sessionId ?? req.headers['x-session-id'] ?? null,
});

const assertIdentity = (userId, sessionId, next) => {
  if (!userId && !sessionId) {
    next(new ErrorResponse('No session or user identity found', 401));
    return false;
  }
  return true;
};

export const getCart = async (req, res, next) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    if (!assertIdentity(userId, sessionId, next)) return;

    const cart = await cartService.getCart(userId, sessionId);
    return res.json({ success: true, cart: cart ?? EMPTY_CART });
  } catch (err) {
    return next(err);
  }
};

export const addToCart = async (req, res, next) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    if (!assertIdentity(userId, sessionId, next)) return;

    const { productId, quantity = 1 } = req.body;

    if (!productId || !OBJECT_ID_RE.test(productId)) {
      return next(new ErrorResponse('Invalid product ID', 400));
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
      return next(new ErrorResponse('Quantity must be an integer between 1 and 100', 400));
    }

    const cart = await cartService.addToCart(userId, sessionId, productId, qty);
    return res.status(201).json({ success: true, cart });
  } catch (err) {
    return next(err);
  }
};

export const updateCartItem = async (req, res, next) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    if (!assertIdentity(userId, sessionId, next)) return;

    const { productId, quantity } = req.body;

    if (!productId || !OBJECT_ID_RE.test(productId)) {
      return next(new ErrorResponse('Invalid product ID', 400));
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
      return next(new ErrorResponse('Quantity must be an integer between 1 and 100', 400));
    }

    const cart = await cartService.updateCartItem(userId, sessionId, productId, qty);
    return res.json({ success: true, cart });
  } catch (err) {
    return next(err);
  }
};

export const removeFromCart = async (req, res, next) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    if (!assertIdentity(userId, sessionId, next)) return;

    const { productId } = req.params;
    if (!productId || !OBJECT_ID_RE.test(productId)) {
      return next(new ErrorResponse('Invalid product ID', 400));
    }

    const cart = await cartService.removeFromCart(userId, sessionId, productId);
    return res.json({ success: true, cart });
  } catch (err) {
    return next(err);
  }
};

export const clearCart = async (req, res, next) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    if (!assertIdentity(userId, sessionId, next)) return;

    await cartService.clearCart(userId, sessionId);
    return res.json({ success: true, cart: EMPTY_CART });
  } catch (err) {
    return next(err);
  }
};

export const applyCoupon = async (req, res, next) => {
  try {
    const { userId, sessionId } = getIdentifiers(req);
    if (!assertIdentity(userId, sessionId, next)) return;

    const code = typeof req.body.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    if (!code || !COUPON_RE.test(code)) {
      return next(new ErrorResponse('Invalid coupon code', 400));
    }

    const cart = await cartService.applyCoupon(userId, sessionId, code);
    return res.json({ success: true, cart });
  } catch (err) {
    return next(err);
  }
};