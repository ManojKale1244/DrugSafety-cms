import mongoose from 'mongoose';

const duplicateReviewSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
      index: true,
    },
    candidateCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
      index: true,
    },
    sourceCaseNumber: {
      type: String,
      default: '',
      trim: true,
    },
    candidateCaseNumber: {
      type: String,
      default: '',
      trim: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true,
    },
    matchedFields: {
      type: [String],
      default: [],
    },
    breakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    decision: {
      type: String,
      enum: ['PENDING', 'CONFIRMED_DUPLICATE', 'NOT_DUPLICATE'],
      default: 'PENDING',
      index: true,
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    decidedAt: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Ensure a single pair cannot have duplicate review records in the queue
duplicateReviewSchema.index({ sourceId: 1, candidateCaseId: 1 }, { unique: true });

export const DuplicateReview = mongoose.model('DuplicateReview', duplicateReviewSchema);
