import mongoose from 'mongoose';

const validationErrorSchema = new mongoose.Schema(
  {
    path: { type: String, required: true },
    message: { type: String, required: true },
  },
  { _id: false },
);

const icsrMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['IN', 'OUT'],
      required: true,
      index: true,
    },
    format: {
      type: String,
      enum: ['XML', 'JSON'],
      default: 'JSON',
      index: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'VALIDATED', 'FAILED', 'PROCESSED', 'ACKNOWLEDGED'],
      default: 'VALIDATED',
      index: true,
    },
    payload: {
      type: String,
      required: true,
    },
    parsedData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    validationErrors: {
      type: [validationErrorSchema],
      default: [],
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      default: null,
      index: true,
    },
    caseNumber: {
      type: String,
      default: null,
      index: true,
    },
    intakeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Intake',
      default: null,
      index: true,
    },
    intakeNumber: {
      type: String,
      default: null,
      index: true,
    },
    duplicateScreening: {
      hasDuplicateWarning: { type: Boolean, default: false },
      highestScore: { type: Number, default: 0 },
      matchedCaseNumber: { type: String, default: null },
      matchedFields: { type: [String], default: [] },
    },
    ackRef: {
      type: String,
      default: null,
    },
    senderIdentifier: {
      type: String,
      default: 'SPONSOR-SAFETY',
    },
    receiverIdentifier: {
      type: String,
      default: 'HEALTH-AUTHORITY-GATEWAY',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const IcsrMessage = mongoose.model('IcsrMessage', icsrMessageSchema);

