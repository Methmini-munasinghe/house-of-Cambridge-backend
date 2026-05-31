import { Router } from 'express';
import * as ctrl from '../controllers/orderController.js';
import * as returnCtrl from '../controllers/returnController.js';
import upload from '../middleware/upload.js';
import { protect, authorize, optionalAuth } from '../middleware/auth.js';
import { param, body } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();

router.post('/', optionalAuth, ctrl.createOrder);

router.get('/my-orders', protect, ctrl.getMyOrders);

router.get('/my-returns', protect, returnCtrl.getMyReturns);

router.post(
  '/:id/return',
  protect,
  param('id').isMongoId(),
  body('reason').isIn(['wrong_item', 'damaged', 'defective', 'not_as_described', 'changed_mind', 'other']),
  body('resolution').optional().isIn(['refund', 'exchange', 'store_credit']),
  body('description').optional().trim().isLength({ max: 1000 }).escape(),
  validate,
  upload.array('images', 5),
  returnCtrl.createReturn,
);

router.get(
  '/returns/:id',
  protect,
  param('id').isMongoId(),
  validate,
  returnCtrl.getReturn,
);

router.get(
  '/',
  protect,
  authorize('admin', 'superadmin'),
  ctrl.getAllOrders,
);

router.get(
  '/:id',
  optionalAuth,
  param('id').isMongoId(),
  validate,
  ctrl.getOrder,
);

router.put(
  '/:id/status',
  protect,
  authorize('admin', 'superadmin'),
  param('id').isMongoId(),
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned']),
  validate,
  ctrl.updateOrderStatus,
);

export default router;