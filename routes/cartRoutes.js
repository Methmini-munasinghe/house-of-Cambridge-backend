import { Router } from 'express';
import * as ctrl from '../controllers/cartController.js';
import { optionalAuth } from '../middleware/auth.js';
import { param, body } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(optionalAuth);

router.get('/', ctrl.getCart);

router.post(
  '/add',
  body('productId').isMongoId(),
  body('quantity').isInt({ min: 1, max: 100 }),
  validate,
  ctrl.addToCart,
);

router.put(
  '/update',
  body('productId').isMongoId(),
  body('quantity').isInt({ min: 0, max: 100 }),
  validate,
  ctrl.updateCartItem,
);

router.delete(
  '/item/:productId',
  param('productId').isMongoId(),
  validate,
  ctrl.removeFromCart,
);

router.delete('/', ctrl.clearCart);

router.post(
  '/coupon',
  body('code').trim().notEmpty().isLength({ max: 50 }).toUpperCase(),
  validate,
  ctrl.applyCoupon,
);

export default router;