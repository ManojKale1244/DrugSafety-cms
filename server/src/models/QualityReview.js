import mongoose from 'mongoose';

const reviewResultItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'MAJOR', 'MINOR'],
      default: 'MAJOR',
    },
    status: {
      type: String,
      enum: ['pass', 'fail', 'na'],
      required: true,
      default: 'pass',
    },
    comment: {
      type: String,
      default: '',
      trim: true,
    },
    targetField: {
      type: String,
      default: 'overview',
    },
  },
  { _id: true },
);

const autoCheckResultSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'MAJOR', 'MINOR'],
      default: 'CRITICAL',
    },
    passed: {
      type: Boolean,
      required: true,
    },
    message: {
      type: String,
      default: '',
    },
    targetField: {
      type: String,
      default: 'overview',
    },
  },
  { _id: false },
);

const qualityReviewSchema = new mongoose.Schema(
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
      trim: true,
      index: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reviewerName: {
      type: String,
      default: '',
    },
    processorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    processorName: {
      type: String,
      default: 'Unassigned',
    },
    results: {
      type: [reviewResultItemSchema],
      default: [],
    },
    autoCheckResults: {
      type: [autoCheckResultSchema],
      default: [],
    },
    decision: {
      type: String,
      enum: ['APPROVED', 'RETURNED'],
      required: true,
      index: true,
    },
    returnReason: {
      type: String,
      default: '',
      trim: true,
    },
    returnToStage: {
      type: String,
      enum: ['MEDICAL_REVIEW', 'DATA_ENTRY'],
      default: 'MEDICAL_REVIEW',
    },
    isFirstPass: {
      type: Boolean,
      default: true,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export const QualityReview = mongoose.model('QualityReview', qualityReviewSchema);

