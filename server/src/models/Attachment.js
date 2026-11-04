import mongoose from 'mongoose';

const attachmentVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    hash: { type: String, required: true },
    size: { type: Number, required: true },
    storageKey: { type: String, required: true },
    mime: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    uploadedByName: { type: String, default: 'System' },
    uploadedAt: { type: Date, default: Date.now },
    reason: { type: String, default: '' },
  },
  { _id: true },
);

const attachmentSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      default: null,
      index: true,
    },
    intakeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Intake',
      default: null,
      index: true,
    },
    caseNumber: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    intakeNumber: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mime: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 1,
    },
    hash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    uploadedByName: {
      type: String,
      default: 'Safety Specialist',
    },
    category: {
      type: String,
      enum: [
        'SOURCE_DOCUMENT',
        'LAB_RESULT',
        'HOSPITAL_RECORD',
        'CORRESPONDENCE',
        'REGULATORY_SUBMISSION',
        'LITERATURE',
        'OTHER',
      ],
      default: 'SOURCE_DOCUMENT',
      index: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    storageProvider: {
      type: String,
      enum: ['LOCAL_DISK', 'S3_R2'],
      default: 'LOCAL_DISK',
    },
    virusScan: {
      scanned: { type: Boolean, default: true },
      status: {
        type: String,
        enum: ['CLEAN', 'INFECTED', 'PENDING'],
        default: 'CLEAN',
      },
      scannedAt: { type: Date, default: Date.now },
      scanEngine: {
        type: String,
        default: 'Synthetic Heuristic Antivirus Engine',
      },
    },
    versionHistory: {
      type: [attachmentVersionSchema],
      default: [],
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    syntheticNotice: {
      type: String,
      default:
        'Controlled pharmacovigilance clinical source document. Access is restricted and all download events are audited under 21 CFR Part 11.',
    },
  },
  {
    timestamps: true,
  },
);

attachmentSchema.index({ caseId: 1, isArchived: 1 });
attachmentSchema.index({ intakeId: 1, isArchived: 1 });
attachmentSchema.index({ createdAt: -1 });

export const Attachment = mongoose.model('Attachment', attachmentSchema);

