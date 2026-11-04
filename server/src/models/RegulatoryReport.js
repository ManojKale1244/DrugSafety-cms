import mongoose from 'mongoose';

const reportHistorySchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      required: true,
    },
    toStatus: {
      type: String,
      required: true,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    byName: {
      type: String,
      default: 'System',
    },
    at: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: true },
);

const validationErrorItemSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['ERROR', 'WARNING'],
      default: 'ERROR',
    },
  },
  { _id: false },
);

const regulatoryReportSchema = new mongoose.Schema(
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
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportingRule',
      required: true,
      index: true,
    },
    ruleCode: {
      type: String,
      required: true,
      trim: true,
    },
    ruleVersion: {
      type: Number,
      required: true,
    },
    ruleName: {
      type: String,
      default: '',
    },
    jurisdiction: {
      type: String,
      required: true,
      enum: ['FDA', 'EMA', 'CDSCO', 'PMDA', 'MHRA', 'WHO', 'GLOBAL'],
      index: true,
    },
    reportType: {
      type: String,
      required: true,
      trim: true,
    },
    deadlineDays: {
      type: Number,
      required: true,
    },
    receiptDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'VALIDATED', 'APPROVED', 'SUBMITTED', 'ACKNOWLEDGED', 'OVERDUE'],
      default: 'DRAFT',
      index: true,
    },
    validationErrors: {
      type: [validationErrorItemSchema],
      default: [],
    },
    isValid: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedByName: {
      type: String,
      default: '',
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    submittedByName: {
      type: String,
      default: '',
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    submissionChannel: {
      type: String,
      default: 'ICH E2B(R3) AS2 Gateway (Synthetic)',
    },
    transmissionId: {
      type: String,
      default: '',
    },
    ackRef: {
      type: String,
      default: '',
      trim: true,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    acknowledgedBy: {
      type: String,
      default: '',
    },
    payloadSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    notes: {
      type: String,
      default: '',
    },
    syntheticNotice: {
      type: String,
      default:
        'Synthetic educational regulatory submission record. Not submitted to real health authorities.',
    },
    history: {
      type: [reportHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

regulatoryReportSchema.index({ caseId: 1, ruleId: 1 }, { unique: true });

export const RegulatoryReport = mongoose.model('RegulatoryReport', regulatoryReportSchema);

