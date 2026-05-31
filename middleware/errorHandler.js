import ErrorResponse from '../utils/errorResponse.js';
import { logger } from '../utils/logger.js';

const errorHandler = (err, req, res, _next) => {
  // ── DEBUG: print every error to terminal so we can see what's failing ──
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error(`🔴 ${req.method} ${req.originalUrl}`);
  console.error(`🔴 NAME:    ${err.name}`);
  console.error(`🔴 MESSAGE: ${err.message}`);
  console.error(`🔴 STACK:\n${err.stack}`);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  logger.error(err.message, {
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    user: req.user?._id?.toString() ?? 'guest',
  });

  let error = new ErrorResponse(err.message || 'Server Error', err.statusCode || 500);

  if (err.name === 'CastError') {
    error = new ErrorResponse('Resource not found', 404);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'Field';
    error = new ErrorResponse(`${field} already exists`, 400);
  } else if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((v) => v.message).join(', ');
    error = new ErrorResponse(message, 400);
  } else if (err.name === 'JsonWebTokenError') {
    error = new ErrorResponse('Invalid token', 401);
  } else if (err.name === 'TokenExpiredError') {
    error = new ErrorResponse('Token expired', 401);
  }

  const isDev = process.env.NODE_ENV === 'development';

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(isDev && { stack: err.stack }),
  });
};

export default errorHandler;