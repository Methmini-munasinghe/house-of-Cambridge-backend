import User from '../model/User.js';

export const findById = (id) =>
  User.findById(id).select('-password -resetPasswordToken -emailVerificationToken');

export const findByEmail = (email) =>
  User.findOne({ email }).select('+password');

export const create = (data) => User.create(data);

export const update = (id, data) =>
  User.findByIdAndUpdate(id, data, { returnDocument: 'after', runValidators: true })
    .select('-password -resetPasswordToken -emailVerificationToken');

export const findByResetToken = (token) =>
  User.findOne({
    resetPasswordToken: token,
    resetPasswordExpire: { $gt: Date.now() },
  });

export const findByVerificationToken = (token) =>
  User.findOne({
    emailVerificationToken: token,
    emailVerificationExpire: { $gt: Date.now() },
  });

export const findAll = (query) => User.find(query);

export const countAll = (query) => User.countDocuments(query);