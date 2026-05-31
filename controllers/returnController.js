import Return from '../model/Return.js';
import Order from '../model/Order.js';
import ErrorResponse from '../utils/errorResponse.js';
import { uploadBuffer } from '../utils/cloudinaryHelper.js';

const OBJECT_ID_RE   = /^[a-f\d]{24}$/i;
const MAX_IMAGES     = 5;
const ALLOWED_ROLES  = Object.freeze(['admin', 'superadmin']);
const ALLOWED_RESOLUTIONS = Object.freeze(['refund', 'exchange', 'store_credit']);
const ALLOWED_REASONS     = Object.freeze([
  'damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'other',
]);

const validateObjectId = (id, label = 'ID') => {
  if (!id || !OBJECT_ID_RE.test(id)) throw new ErrorResponse(`Invalid ${label}`, 400);
};

const isAdmin = (user) => ALLOWED_ROLES.includes(user?.role);

const sanitiseItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items.map((item) => {
    if (!item.product || !OBJECT_ID_RE.test(String(item.product))) {
      throw new ErrorResponse('Each return item must have a valid product ID', 400);
    }
    const qty = parseInt(item.quantity, 10);
    if (!Number.isInteger(qty) || qty < 1) {
      throw new ErrorResponse('Each return item must have a positive integer quantity', 400);
    }
    return {
      product:  item.product,
      name:     typeof item.name     === 'string' ? item.name.slice(0, 200)     : '',
      image:    typeof item.image    === 'string' ? item.image.slice(0, 500)    : '',
      price:    Number.isFinite(Number(item.price)) ? Number(item.price)        : 0,
      quantity: qty,
    };
  });
};

export const createReturn = async (req, res, next) => {
  try {
    validateObjectId(req.params.id, 'order ID');

    if (!req.user?._id) return next(new ErrorResponse('Authentication required', 401));

    const order = await Order.findById(req.params.id).select(
      'user orderStatus items _id',
    );
    if (!order) return next(new ErrorResponse('Order not found', 404));

    if (order.user?.toString() !== req.user._id.toString()) {
      return next(new ErrorResponse('Access denied', 403));
    }

    if (order.orderStatus !== 'delivered') {
      return next(new ErrorResponse('Only delivered orders can be returned', 400));
    }

    const existing = await Return.findOne({ order: order._id }).select('_id').lean();
    if (existing) return next(new ErrorResponse('Return already initiated for this order', 409));

    const { reason, description, resolution, items } = req.body;

    if (!reason || !ALLOWED_REASONS.includes(reason)) {
      return next(new ErrorResponse(`Reason must be one of: ${ALLOWED_REASONS.join(', ')}`, 400));
    }

    if (resolution && !ALLOWED_RESOLUTIONS.includes(resolution)) {
      return next(new ErrorResponse(`Resolution must be one of: ${ALLOWED_RESOLUTIONS.join(', ')}`, 400));
    }

    let returnItems;
    try {
      returnItems = sanitiseItems(items) ?? order.items.map((i) => ({
        product:  i.product,
        name:     i.name,
        image:    i.image,
        price:    i.price,
        quantity: i.quantity,
      }));
    } catch (validationErr) {
      return next(validationErr);
    }

    let images = [];
    if (req.files?.length) {
      const files = req.files.slice(0, MAX_IMAGES);
      const uploaded = await Promise.all(
        files.map((f) => uploadBuffer(f.buffer, 'returns')),
      );
      images = uploaded
        .filter((r) => r?.public_id && r?.secure_url)
        .map((r) => ({ public_id: r.public_id, url: r.secure_url }));
    }

    const ret = await Return.create({
      order:       order._id,
      user:        req.user._id,
      items:       returnItems,
      reason,
      description: typeof description === 'string' ? description.slice(0, 1000) : '',
      resolution:  resolution ?? 'refund',
      images,
    });

    await Order.findByIdAndUpdate(order._id, { orderStatus: 'return_requested' });

    return res.status(201).json({ success: true, return: ret });
  } catch (err) {
    return next(err);
  }
};

export const getMyReturns = async (req, res, next) => {
  try {
    if (!req.user?._id) return next(new ErrorResponse('Authentication required', 401));

    const returns = await Return.find({ user: req.user._id })
      .populate('order', 'orderNumber total')
      .sort('-createdAt')
      .lean();

    return res.json({ success: true, count: returns.length, returns });
  } catch (err) {
    return next(err);
  }
};

export const getReturn = async (req, res, next) => {
  try {
    validateObjectId(req.params.id, 'return ID');

    if (!req.user?._id) return next(new ErrorResponse('Authentication required', 401));

    const ret = await Return.findById(req.params.id)
      .populate('order', 'orderNumber total items')
      .populate('user', 'name email');

    if (!ret) return next(new ErrorResponse('Return not found', 404));

    const isOwner = ret.user?._id?.toString() === req.user._id.toString();
    if (!isOwner && !isAdmin(req.user)) {
      return next(new ErrorResponse('Access denied', 403));
    }

    return res.json({ success: true, return: ret });
  } catch (err) {
    return next(err);
  }
};