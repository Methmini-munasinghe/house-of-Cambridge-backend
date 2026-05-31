import mongoose from 'mongoose';
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true, maxlength: 300 },
  image: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  isReviewed: { type: Boolean, default: false },
});
const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    guestEmail: { type: String, default: '', maxlength: 254 },
    guestName: { type: String, default: '', maxlength: 100 },
    orderNumber: {
      type: String,
      unique: true,
    },
    items: [orderItemSchema],
    shippingAddress: {
      fullName: { type: String, maxlength: 100 },
      phone: { type: String, maxlength: 20 },
      addressLine1: { type: String, maxlength: 200 },
      addressLine2: { type: String, maxlength: 200 },
      city: { type: String, maxlength: 100 },
      state: { type: String, maxlength: 100 },
      postalCode: { type: String, maxlength: 20 },
      country: { type: String, default: 'Sri Lanka', maxlength: 100 },
    },
    paymentMethod: { type: String, enum: ['card', 'paypal', 'koko', 'cod', 'bank_transfer'], default: 'card' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    paymentId: { type: String, default: '', maxlength: 200 },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'],
      default: 'pending',
    },
    shippingMethod: { type: String, enum: ['pickup', 'courier', 'post'], default: 'courier' },
    subtotal: { type: Number, required: true, min: 0 },
    shippingCost: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    coupon: { type: String, default: '', maxlength: 50 },
    loyaltyPointsUsed: { type: Number, default: 0, min: 0 },
    loyaltyPointsEarned: { type: Number, default: 0, min: 0 },
    trackingNumber: { type: String, default: '', maxlength: 100 },
    deliveredAt: Date,
    cancelledAt: Date,
    notes: { type: String, default: '', maxlength: 500 },
    returnRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'Return', default: null },
    adminNotes: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true },
);
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ guestEmail: 1 });
orderSchema.pre('save', async function () {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `HOC-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }
});
export default mongoose.model('Order', orderSchema);