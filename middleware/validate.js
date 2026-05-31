import { validationResult } from 'express-validator';
import ErrorResponse from '../utils/errorResponse.js';

export const validate = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join(', ');
    return next(new ErrorResponse(message, 422));
  }
  next();
};