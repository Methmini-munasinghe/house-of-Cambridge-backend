import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fullName: { type: String, required: true, maxlength: 100 },
    phone: { type: String, required: true, maxlength: 20 },
    addressLine1: { type: String, required: true, maxlength: 200 },
    addressLine2: { type: String, default: '', maxlength: 200 },
    city: { type: String, required: true, maxlength: 100 },
    state: { type: String, required: true, maxlength: 100 },
    postalCode: { type: String, required: true, maxlength: 20 },
    country: { type: String, required: true, default: 'Sri Lanka', maxlength: 100 },
    isDefault: { type: Boolean, default: false },
    label: { type: String, enum: ['Home', 'Work', 'Other'], default: 'Home' },
  },
  { timestamps: true },
);

addressSchema.index({ user: 1 });

export default mongoose.model('Address', addressSchema);