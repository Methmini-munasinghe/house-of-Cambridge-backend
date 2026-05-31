import Cart from '../model/Cart.js';

export const findByUser = (userId) =>
  Cart.findOne({ user: userId }).populate('items.product coupon');

export const findBySession = (sessionId) =>
  Cart.findOne({ sessionId }).populate('items.product coupon');

export const upsertForUser = (userId, data) =>
  Cart.findOneAndUpdate({ user: userId }, data, { returnDocument: 'after', upsert: true })
    .populate('items.product');

export const upsertForSession = (sessionId, data) =>
  Cart.findOneAndUpdate({ sessionId }, data, { returnDocument: 'after', upsert: true })
    .populate('items.product');

export const remove = (id) => Cart.findByIdAndDelete(id);