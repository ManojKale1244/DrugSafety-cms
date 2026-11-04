import mongoose from 'mongoose';

const codingHistorySchema = new mongoose.Schema(
  {
    codedTermId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Term',
      required: true,
    },
    codedTermSnapshot: {
      code: { type: String, default: '' },
      name: { type: String, default: '' },
      level: { type: String, default: '' },
      hierarchy: { type: Array, default: [] },
    },
    codedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    codedByName: {
      type: String,
      default: 'System',
    },
    codedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    dictionaryVersion: {
      type: String,
      default: 'SYN-MedDRA-27.0',
    },
  },
  { _id: true },
);

const codingRecordSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
      index: true,
    },
    reactionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    verbatimText: {
      type: String,
      required: true,
      trim: true,
    },
    codedTermId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Term',
      required: true,
      index: true,
    },
    dictionaryVersion: {
      type: String,
      default: 'SYN-MedDRA-27.0',
      index: true,
    },
    codedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    codedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['coded', 'overridden', 'uncoded'],
      default: 'coded',
      index: true,
    },
    history: {
      type: [codingHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to guarantee fast lookup by case and reaction
codingRecordSchema.index({ caseId: 1, reactionId: 1 }, { unique: true });

export const CodingRecord = mongoose.model('CodingRecord', codingRecordSchema);

