import mongoose from 'mongoose';

const returnItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: { type: String, maxlength: 200 },
  image: { type: String },
  price: { type: Number, min: 0 },
  quantity: { type: Number, min: 1, default: 1 },
});

const returnSchema = new mongoose.Schema(
  {
    returnId: { type: String, unique: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [returnItemSchema],
    reason: {
      type: String,
      enum: ['wrong_item', 'damaged', 'defective', 'not_as_described', 'changed_mind', 'other'],
      required: true,
    },
    description: { type: String, default: '', maxlength: 1000 },
    resolution: {
      type: String,
      enum: ['refund', 'exchange', 'store_credit'],
      default: 'refund',
    },
    status: {
      type: String,
      enum: ['pending', 'in_review', 'approved', 'rejected', 'collected', 'qc', 'refunded'],
      default: 'pending',
    },
    images: [{ public_id: String, url: String }],
    refundAmount: { type: Number, default: 0, min: 0 },
    refundMethod: { type: String, default: '', maxlength: 100 },
    adminNotes: { type: String, default: '', maxlength: 1000 },
    resolvedAt: Date,
  },
  { timestamps: true },
);

returnSchema.pre('save', async function () {
  if (!this.returnId) {
    const count = await mongoose.model('Return').countDocuments();
    this.returnId = `RTN-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }
});

returnSchema.index({ user: 1, createdAt: -1 });
returnSchema.index({ status: 1 });
returnSchema.index({ order: 1 });

export default mongoose.model('Return', returnSchema);