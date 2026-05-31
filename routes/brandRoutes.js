import { Router } from 'express';
import multer from 'multer';
import { getBrands, getBrand, createBrand, updateBrand, deleteBrand } from '../controllers/brandController.js';
import { protect, authorize } from '../middleware/auth.js';
import { param } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

router.get('/', getBrands);
router.get('/:id', param('id').isMongoId(), validate, getBrand);

router.post('/', protect, authorize('admin', 'superadmin'), upload.single('logo'), createBrand);

router.put(
  '/:id',
  protect,
  authorize('admin', 'superadmin'),
  param('id').isMongoId(),
  validate,
  upload.single('logo'),
  updateBrand,
);

router.delete(
  '/:id',
  protect,
  authorize('admin', 'superadmin'),
  param('id').isMongoId(),
  validate,
  deleteBrand,
);

export default router;