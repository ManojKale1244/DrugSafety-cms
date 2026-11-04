import mongoose from 'mongoose';

const causalityPairSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    reactionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    reactionVerbatim: {
      type: String,
      required: true,
      trim: true,
    },
    reactionPt: {
      type: String,
      default: '',
      trim: true,
    },
    causality: {
      type: String,
      enum: [
        'Certain',
        'Probable',
        'Possible',
        'Unlikely',
        'Conditional',
        'Unassessable',
        'Not Assessed',
      ],
      default: 'Not Assessed',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: true },
);

const requestForInfoSchema = new mongoose.Schema(
  {
    query: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['Routine', 'Urgent'],
      default: 'Routine',
    },
    status: {
      type: String,
      enum: ['Pending', 'Received', 'Closed'],
      default: 'Pending',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedToName: {
      type: String,
      default: 'Unassigned',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    requestedByName: {
      type: String,
      default: 'Medical Reviewer',
    },
    response: {
      type: String,
      default: '',
      trim: true,
    },
    actionItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ActionItem',
      default: null,
    },
  },
  { _id: true },
);

const assessmentHistorySchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewerName: { type: String, default: '' },
    seriousnessCriteria: [{ type: String }],
    expectedness: { type: String, default: 'unknown' },
    causality: [causalityPairSchema],
    medicalComment: { type: String, default: '' },
    status: { type: String, default: 'SIGNED' },
    signedAt: { type: Date, default: null },
    signedByName: { type: String, default: '' },
    signedRole: { type: String, default: '' },
    supersededAt: { type: Date, default: Date.now },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    supersedeReason: { type: String, default: '' },
  },
  { _id: true },
);

const medicalAssessmentSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
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
      trim: true,
    },
    seriousnessCriteria: {
      type: [String],
      enum: [
        'death',
        'life-threatening',
        'hospitalization',
        'disability',
        'congenital anomaly',
        'medically important',
      ],
      default: [],
    },
    expectedness: {
      type: String,
      enum: ['listed', 'unlisted', 'unknown', 'Listed', 'Unlisted', 'Unknown'],
      default: 'unknown',
    },
    causality: {
      type: [causalityPairSchema],
      default: [],
    },
    medicalComment: {
      type: String,
      default: '',
      trim: true,
    },
    requestsForInfo: {
      type: [requestForInfoSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['DRAFT', 'SIGNED'],
      default: 'DRAFT',
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    signedAt: {
      type: Date,
      default: null,
    },
    signedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    signedByName: {
      type: String,
      default: '',
    },
    signedRole: {
      type: String,
      default: '',
    },
    signatureStatement: {
      type: String,
      default: '',
    },
    supersedes: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalAssessment',
      default: null,
    },
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalAssessment',
      default: null,
    },
    isLatest: {
      type: Boolean,
      default: true,
      index: true,
    },
    history: {
      type: [assessmentHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to quickly fetch the latest assessment of a case
medicalAssessmentSchema.index({ caseId: 1, isLatest: 1 });
medicalAssessmentSchema.index({ caseId: 1, version: -1 });

export const MedicalAssessment = mongoose.model('MedicalAssessment', medicalAssessmentSchema);

