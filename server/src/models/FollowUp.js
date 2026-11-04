import mongoose from 'mongoose';

const correspondenceSchema = new mongoose.Schema(
  {
    attemptNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    channel: {
      type: String,
      enum: ['EMAIL', 'PHONE', 'LETTER', 'PORTAL'],
      default: 'EMAIL',
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    sentByName: {
      type: String,
      default: 'Safety Officer',
    },
    notes: {
      type: String,
      default: '',
    },
    content: {
      type: String,
      default: '',
    },
  },
  { _id: true },
);

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, default: '' },
    size: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const followUpSchema = new mongoose.Schema(
  {
    followUpNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
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
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requestedByName: {
      type: String,
      default: '',
    },
    recipient: {
      name: { type: String, required: true, trim: true },
      role: { type: String, default: 'Reporter' }, // 'Reporter', 'Physician', 'Patient', 'Hospital', 'Other'
      contact: { type: String, default: '', trim: true },
      method: {
        type: String,
        enum: ['EMAIL', 'PHONE', 'LETTER', 'PORTAL'],
        default: 'EMAIL',
      },
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'RECEIVED', 'CLOSED', 'NO_RESPONSE'],
      default: 'OPEN',
      index: true,
    },
    correspondence: {
      type: [correspondenceSchema],
      default: [],
    },
    attemptsCount: {
      type: Number,
      default: 1,
    },
    receivedInfo: {
      rawResponse: { type: String, default: '' },
      summaryOfChanges: { type: String, default: '' },
      updatedFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    receivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    receivedByName: {
      type: String,
      default: '',
    },
    linkedAttachments: {
      type: [attachmentSchema],
      default: [],
    },
    resultingCaseVersion: {
      type: Number,
      default: null,
    },
    reopenedReviewTask: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export const FollowUp = mongoose.model('FollowUp', followUpSchema);

