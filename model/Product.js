import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 300 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true },
    shortDescription: { type: String, default: '', maxlength: 500 },
    price: { type: Number, required: true, min: 0 },
    discountPrice: { type: Number, default: 0, min: 0 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, required: true, default: 0, min: 0 },
    sku: { type: String, unique: true, sparse: true, maxlength: 100 },
    brand: { type: String, default: '', maxlength: 100 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    images: [
      {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
    specifications: [{ key: { type: String, maxlength: 100 }, value: { type: String, maxlength: 300 } }],
    tags: [{ type: String, maxlength: 50 }],
    ratings: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0, min: 0 },
    isFlashSale: { type: Boolean, default: false },
    flashSalePrice: { type: Number, default: 0, min: 0 },
    flashSaleEnds: { type: Date },
    isFeatured: { type: Boolean, default: false },
    isPreOwned: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    weight: { type: Number, default: 0, min: 0 },
    usageInstructions: [{ type: String, maxlength: 500 }],
  },
  { timestamps: true },
);

productSchema.index({ name: 'text', description: 'text', brand: 'text', tags: 'text' });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ price: 1 });
productSchema.index({ ratings: -1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
productSchema.index({ isActive: 1, isFlashSale: 1 });

export default mongoose.model('Product', productSchema);