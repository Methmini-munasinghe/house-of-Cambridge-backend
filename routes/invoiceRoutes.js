import { Router } from 'express';
import * as ctrl from '../controllers/invoiceController.js';
import { protect, authorize } from '../middleware/auth.js';
import { param, body } from 'express-validator';
import { validate } from '../middleware/validate.js';

const router = Router();

// Protect all cascading invoice endpoints under the administrator authentication guard
router.use(protect, authorize('admin', 'superadmin'));

// Route for fetching all invoices and creating a new invoice record
router.route('/')
  .get(ctrl.getInvoices)
  .post(
    body('invoiceType').isIn(['online', 'manual']).withMessage('Invoice type must be online or manual'),
    body('clientDetails.clientName').trim().notEmpty().withMessage('Client name is required').escape(),
    body('clientDetails.email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
    body('items').isArray({ min: 1 }).withMessage('Invoice must contain at least one item'),
    body('items.*.productId').isMongoId().withMessage('Valid Product ID is required for each line item'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    validate,
    ctrl.createInvoice
  );

export default router;