import mongoose from 'mongoose';

const workflowHistorySchema = new mongoose.Schema(
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
    from: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    to: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    byName: {
      type: String,
      default: 'System',
    },
    byRole: {
      type: String,
      default: '',
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    isBackward: {
      type: Boolean,
      default: false,
    },
    at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

workflowHistorySchema.index({ caseId: 1, at: -1 });

export const WorkflowHistory = mongoose.model('WorkflowHistory', workflowHistorySchema);

