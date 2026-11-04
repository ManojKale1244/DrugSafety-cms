import mongoose from 'mongoose';

const diffItemSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    label: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const caseAmendmentSchema = new mongoose.Schema(
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
    version: {
      type: Number,
      required: true,
    },
    previousVersion: {
      type: Number,
      required: true,
    },
    followUpId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FollowUp',
      default: null,
      index: true,
    },
    followUpNumber: {
      type: String,
      default: null,
    },
    amendmentType: {
      type: String,
      enum: ['FOLLOW_UP', 'MANUAL_EDIT', 'REGULATORY_UPDATE'],
      default: 'FOLLOW_UP',
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    diff: {
      type: [diffItemSchema],
      default: [],
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    appliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    appliedByName: {
      type: String,
      default: '',
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

caseAmendmentSchema.index({ caseId: 1, version: 1 }, { unique: true });

export const CaseAmendment = mongoose.model('CaseAmendment', caseAmendmentSchema);

