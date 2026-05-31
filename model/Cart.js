import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1, max: 100, default: 1 },
  price: { type: Number, required: true, min: 0 },
});

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sessionId: { type: String, default: null, maxlength: 128 },
    items: [cartItemSchema],
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
    discount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

cartSchema.virtual('subtotal').get(function () {
  return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
});

cartSchema.index({ user: 1 });
cartSchema.index({ sessionId: 1 });

export default mongoose.model('Cart', cartSchema);