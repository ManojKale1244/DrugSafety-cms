import mongoose from 'mongoose';

const intakeSchema = new mongoose.Schema(
  {
    intakeNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['physician', 'patient', 'literature', 'regulator', 'other'],
      default: 'physician',
      index: true,
    },
    receiptDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value <= new Date();
        },
        message: 'Receipt date cannot be in the future',
      },
      index: true,
    },
    reporter: {
      name: { type: String, trim: true, default: '' },
      qualification: { type: String, trim: true, default: 'Physician' },
      contact: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: 'India' },
    },
    patient: {
      reference: { type: String, trim: true, default: '' },
      age: { type: Number, default: null },
      ageUnit: { type: String, enum: ['years', 'months', 'days', 'decades'], default: 'years' },
      sex: { type: String, enum: ['Male', 'Female', 'Other', 'Unknown'], default: 'Unknown' },
      weight: { type: Number, default: null },
    },
    suspectedProduct: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    reportedReaction: {
      type: String,
      required: true,
      trim: true,
    },
    narrative: {
      type: String,
      default: '',
    },
    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, default: '' },
        size: { type: Number, default: 0 },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['RECEIVED', 'VALIDATING', 'INCOMPLETE', 'REJECTED', 'CONVERTED'],
      default: 'RECEIVED',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    convertedCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      default: null,
      index: true,
    },
    convertedCaseNumber: {
      type: String,
      default: null,
      index: true,
    },
    validation: {
      hasMinimumCriteria: { type: Boolean, default: false },
      missingFields: { type: [String], default: [] },
      criteriaStatus: {
        identifiableReporter: { type: Boolean, default: false },
        identifiablePatient: { type: Boolean, default: false },
        suspectProduct: { type: Boolean, default: false },
        reportedEvent: { type: Boolean, default: false },
      },
      duplicateCandidates: [
        {
          caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
          caseNumber: { type: String },
          similarityScore: { type: Number },
          reason: { type: String },
        },
      ],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Intake = mongoose.model('Intake', intakeSchema);
