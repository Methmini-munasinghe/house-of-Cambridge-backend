import { Router } from 'express';
import { getSignature } from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';
import { query } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();

router.get(
  '/signature',
  protect,
  query('subfolder').isIn(['products', 'avatars', 'categories', 'returns']),
  validate,
  getSignature,
);

export default router;