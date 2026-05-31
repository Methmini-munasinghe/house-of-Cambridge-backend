import Order from '../model/Order.js';

export const findById = (id) => Order.findById(id).populate('items.product');

export const findByUser = (userId, options = {}) => {
  const { page = 1, limit = 20, sort = '-createdAt', status } = options;
  const skip = (page - 1) * limit;
  const query = { user: userId };
  if (status) query.orderStatus = status;
  return Order.find(query).sort(sort).skip(skip).limit(limit);
};

export const create = (data) => Order.create(data);

export const update = (id, data) =>
  Order.findByIdAndUpdate(id, data, { returnDocument: 'after' });

export const findAll = (query = {}, options = {}) => {
  const { page = 1, limit = 20, sort = '-createdAt' } = options;
  const skip = (page - 1) * limit;
  return Order.find(query)
    .populate('user', 'name email')
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

export const count = (query) => Order.countDocuments(query);

export const findByOrderNumber = (orderNumber) => Order.findOne({ orderNumber });