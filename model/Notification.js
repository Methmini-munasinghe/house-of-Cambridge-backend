import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    type: { type: String, enum: ['order', 'promotion', 'system', 'review', 'loyalty', 'return'], default: 'system' },
    isRead: { type: Boolean, default: false },
    link: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);