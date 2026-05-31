import { Router } from 'express';
import * as ctrl from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { param, body } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();

router.use(protect);

router.get('/profile', ctrl.getProfile);

router.put(
  '/profile',
  body('name').optional().trim().isLength({ min: 1, max: 100 }).escape(),
  body('phone').optional().trim().matches(/^\+?[\d\s\-()]{7,20}$/),
  body('gender').optional().isIn(['Male', 'Female', 'Non-binary', 'Prefer not to say', '']),
  body('language').optional().trim().isLength({ max: 50 }),
  validate,
  ctrl.updateProfile,
);

router.put('/avatar', upload.single('avatar'), ctrl.updateAvatar);
router.delete('/avatar', ctrl.removeAvatar);

router.get('/addresses', ctrl.getAddresses);

router.post(
  '/addresses',
  body('fullName').trim().notEmpty().isLength({ max: 100 }).escape(),
  body('phone').trim().matches(/^\+?[\d\s\-()]{7,20}$/),
  body('addressLine1').trim().notEmpty().isLength({ max: 200 }).escape(),
  body('city').trim().notEmpty().isLength({ max: 100 }).escape(),
  body('state').trim().notEmpty().isLength({ max: 100 }).escape(),
  body('postalCode').trim().notEmpty().isLength({ max: 20 }).escape(),
  body('country').trim().notEmpty().isLength({ max: 100 }).escape(),
  body('isDefault').optional().isBoolean(),
  body('label').optional().isIn(['Home', 'Work', 'Other']),
  validate,
  ctrl.addAddress,
);

router.put(
  '/addresses/:id',
  param('id').isMongoId(),
  body('fullName').optional().trim().isLength({ min: 1, max: 100 }).escape(),
  body('phone').optional().trim().matches(/^\+?[\d\s\-()]{7,20}$/),
  body('addressLine1').optional().trim().isLength({ max: 200 }).escape(),
  body('city').optional().trim().isLength({ max: 100 }).escape(),
  body('state').optional().trim().isLength({ max: 100 }).escape(),
  body('postalCode').optional().trim().isLength({ max: 20 }).escape(),
  body('isDefault').optional().isBoolean(),
  body('label').optional().isIn(['Home', 'Work', 'Other']),
  validate,
  ctrl.updateAddress,
);

router.delete('/addresses/:id', param('id').isMongoId(), validate, ctrl.deleteAddress);

router.get('/wishlist', ctrl.getWishlist);

router.post(
  '/wishlist/toggle',
  body('productId').isMongoId(),
  validate,
  ctrl.toggleWishlist,
);

router.get('/notifications', ctrl.getNotifications);
router.put('/notifications/read-all', ctrl.markAllNotificationsRead);

router.put(
  '/notifications/:id/read',
  param('id').isMongoId(),
  validate,
  ctrl.markNotificationRead,
);

export default router;