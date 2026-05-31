import jwt from 'jsonwebtoken';
import User from '../model/User.js';
import ErrorResponse from '../utils/errorResponse.js';

const extractToken = (req) => {
  if (req.cookies?.token) return req.cookies.token;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.split(' ')[1];
  return null;
};

export const protect = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next(new ErrorResponse('Not authorized', 401));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new ErrorResponse('Not authorized', 401));
    if (!user.isActive) return next(new ErrorResponse('Account is disabled', 403));
    req.user = user;
    next();
  } catch {
    return next(new ErrorResponse('Not authorized', 401));
  }
};

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ErrorResponse('Access denied', 403));
  }
  next();
};

export const optionalAuth = async (req, _res, next) => {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (user?.isActive) req.user = user;
    } catch {
      req.user = null;
    }
  }
  next();
};