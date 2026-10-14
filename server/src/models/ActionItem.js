import mongoose from 'mongoose';
import { isTaskOverdue, getTaskUrgency } from '../utils/dateUtils.js';

const actionItemSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
      index: true,
    },
    caseNumber: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    dueOn: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

/**
 * Computed virtuals: OVERDUE is never stored, calculated at query/access time using Asia/Kolkata EOD.
 */
actionItemSchema.virtual('isOverdue').get(function () {
  return isTaskOverdue(this.dueOn, this.status);
});

actionItemSchema.virtual('urgency').get(function () {
  return getTaskUrgency(this.dueOn, this.status);
});

export const ActionItem = mongoose.model('ActionItem', actionItemSchema);
