import mongoose from 'mongoose';

const loginHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // May be null if user wasn't found
      index: true,
    },
    emailAttempted: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    ip: {
      type: String,
      default: 'unknown',
    },
    userAgent: {
      type: String,
      default: 'unknown',
    },
    success: {
      type: Boolean,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: null,
    },
    at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

export const LoginHistory = mongoose.model('LoginHistory', loginHistorySchema);
