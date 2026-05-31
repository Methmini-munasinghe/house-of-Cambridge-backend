import mongoose from 'mongoose';
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      maxlength: 120,
    },
    description: { type: String, default: '', maxlength: 500 },
    image: {
      public_id: { type: String, default: '' },
      url: { type: String, default: '' },
    },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);
categorySchema.index({ parent: 1, isActive: 1 });
export default mongoose.model('Category', categorySchema);