import Invoice from '../model/Invoice.js';
import Product from '../model/Product.js';
import ErrorResponse from '../utils/errorResponse.js';

export const createInvoice = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { invoiceType, items, discount = 0, taxPercent = 0, clientDetails, dueDate, assignedPeople, issuedBy } = req.body;

    if (!['online', 'manual'].includes(invoiceType)) {
      return next(new ErrorResponse('Invalid invoice type selection', 400));
    }

    // 1. Automatically Generate the Next Invoice Number based on sequence prefix code
    const prefix = invoiceType === 'online' ? 'O' : 'M';
    const lastInvoice = await Invoice.findOne({ invoiceType })
      .sort({ createdAt: -1 })
      .select('invoiceNo')
      .session(session);

    let nextNumber = 1001; // Starting milestone marker
    if (lastInvoice && lastInvoice.invoiceNo) {
      const currentNum = parseInt(lastInvoice.invoiceNo.substring(1), 10);
      if (!isNaN(currentNum)) nextNumber = currentNum + 1;
    }
    const finalInvoiceNo = `${prefix}${nextNumber}`;

    // 2. Map and Validate Items + Handle Inventory Deductions if MANUAL type
    let derivedSubtotal = 0;
    const processItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new ErrorResponse(`Product not found for ID: ${item.productId}`, 44);

      // Inventory check condition only for physical counter trades (Manual)
      if (invoiceType === 'manual') {
        if (product.stock < item.quantity) {
          throw new ErrorResponse(`Insufficient stock balance for item: ${product.name}. Available: ${product.stock}`, 400);
        }
        // Deduct inventory points safely
        product.stock -= item.quantity;
        await product.save({ session });
      }

      const itemTotal = product.price * item.quantity;
      derivedSubtotal += itemTotal;

      processItems.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        total: itemTotal
      });
    }

    // 3. Mathematical summary breakdown calculations
    const taxAmount = Math.round((derivedSubtotal - discount) * (taxPercent / 100));
    const totalAmountDue = derivedSubtotal - discount + taxAmount;

    const newInvoice = new Invoice({
      invoiceNo: finalInvoiceNo,
      invoiceType,
      dueDate,
      assignedPeople,
      clientDetails,
      items: processItems,
      subtotal: derivedSubtotal,
      discount,
      taxPercent,
      taxAmount,
      totalAmountDue,
      issuedBy
    });

    await newInvoice.save({ session });
    await session.commitTransaction();

    return res.status(201).json({ success: true, invoice: newInvoice });
  } catch (err) {
    await session.abortTransaction();
    return next(err);
  } finally {
    session.endSession();
  }
};

// Get all invoices list for Admin Table view
export const getInvoices = async (req, res, next) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: invoices.length, invoices });
  } catch (err) {
    return next(err);
  }
};