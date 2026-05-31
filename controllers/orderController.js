import * as orderService from '../services/orderService.js';
import * as orderRepo from '../repositories/orderRepository.js';
import ErrorResponse from '../utils/errorResponse.js';

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

const ALLOWED_STATUSES = Object.freeze([
  'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded',
]);

const ALLOWED_ROLES = Object.freeze(['admin', 'manager']);

const sanitiseListQuery = (query) => ({
  page:  Math.max(1, parseInt(query.page, 10) || 1),
  limit: Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20)),
  sort:  ['createdAt', '-createdAt', 'total', '-total'].includes(query.sort)
    ? query.sort
    : '-createdAt',
  status: ALLOWED_STATUSES.includes(query.status) ? query.status : undefined,
});

export const createOrder = async (req, res, next) => {
  try {
    const userId    = req.user?._id ?? null;
    const sessionId = req.cookies?.sessionId ?? req.headers['x-session-id'] ?? null;

    if (!userId && !sessionId) {
      return next(new ErrorResponse('No session or user identity found', 401));
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return next(new ErrorResponse('Invalid order payload', 400));
    }

    const order = await orderService.createOrder(userId, sessionId, req.body);
    return res.status(201).json({ success: true, order });
  } catch (err) {
    return next(err);
  }
};

export const getOrder = async (req, res, next) => {
  try {
    if (!OBJECT_ID_RE.test(req.params.id)) {
      return next(new ErrorResponse('Invalid order ID', 400));
    }

    if (!req.user?._id) {
      return next(new ErrorResponse('Authentication required', 401));
    }

    const order = await orderService.getOrderById(req.params.id, req.user._id, req.user.role);
    if (!order) return next(new ErrorResponse('Order not found', 404));

    return res.json({ success: true, order });
  } catch (err) {
    return next(err);
  }
};

export const getMyOrders = async (req, res, next) => {
  try {
    if (!req.user?._id) {
      return next(new ErrorResponse('Authentication required', 401));
    }

    const { page, limit, sort, status } = sanitiseListQuery(req.query);
    const orders = await orderService.getUserOrders(req.user._id, { page, limit, sort, status });

    return res.json({ success: true, count: orders.length, page, orders });
  } catch (err) {
    return next(err);
  }
};

export const getAllOrders = async (req, res, next) => {
  try {
    if (!req.user?._id) {
      return next(new ErrorResponse('Authentication required', 401));
    }

    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return next(new ErrorResponse('Forbidden', 403));
    }

    const { page, limit, sort, status } = sanitiseListQuery(req.query);
    const filter = status ? { status } : {};

    const orders = await orderRepo.findAll(filter, { page, limit, sort });

    return res.json({ success: true, count: orders.length, page, orders });
  } catch (err) {
    return next(err);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  try {
    if (!OBJECT_ID_RE.test(req.params.id)) {
      return next(new ErrorResponse('Invalid order ID', 400));
    }

    if (!req.user?._id) {
      return next(new ErrorResponse('Authentication required', 401));
    }

    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return next(new ErrorResponse('Forbidden', 403));
    }

    const { status } = req.body;
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return next(new ErrorResponse(`Status must be one of: ${ALLOWED_STATUSES.join(', ')}`, 400));
    }

    const order = await orderService.updateOrderStatus(req.params.id, status);
    if (!order) return next(new ErrorResponse('Order not found', 404));

    return res.json({ success: true, order });
  } catch (err) {
    return next(err);
  }
};