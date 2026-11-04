import mongoose from 'mongoose';

const summaryTabulationItemSchema = new mongoose.Schema(
  {
    product: { type: String, required: true },
    preferredTerm: { type: String, required: true },
    systemOrganClass: { type: String, default: 'General disorders and administration site conditions' },
    country: { type: String, default: 'Global' },
    seriousCount: { type: Number, default: 0 },
    nonSeriousCount: { type: Number, default: 0 },
    fatalCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const lineListingItemSchema = new mongoose.Schema(
  {
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
    caseNumber: { type: String, required: true },
    receiptDate: { type: Date, required: true },
    country: { type: String, default: 'Global' },
    patientAge: { type: String, default: 'N/A' },
    patientSex: { type: String, default: 'Unknown' },
    productName: { type: String, required: true },
    productRole: { type: String, default: 'Suspect' },
    preferredTerm: { type: String, required: true },
    verbatimReaction: { type: String, default: '' },
    seriousness: { type: String, default: 'Non-Serious' },
    seriousnessCriteria: { type: [String], default: [] },
    causality: { type: String, default: 'Unassessed' },
    outcome: { type: String, default: 'unknown' },
  },
  { _id: false },
);

const reportHistoryItemSchema = new mongoose.Schema(
  {
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byName: { type: String, default: 'System' },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: true },
);

const reportRunSchema = new mongoose.Schema(
  {
    definitionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReportDefinition',
      required: true,
      index: true,
    },
    definitionName: {
      type: String,
      required: true,
      trim: true,
    },
    reportType: {
      type: String,
      enum: ['PSUR', 'PBRER', 'DSUR', 'LINE_LISTING', 'SUMMARY_TABULATION', 'CUSTOM'],
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    period: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
    },
    filtersApplied: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['QUEUED', 'RUNNING', 'GENERATED', 'FAILED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'GENERATED',
      index: true,
    },
    summaryTabulation: {
      type: [summaryTabulationItemSchema],
      default: [],
    },
    lineListing: {
      type: [lineListingItemSchema],
      default: [],
    },
    totalCases: {
      type: Number,
      default: 0,
    },
    totalReactions: {
      type: Number,
      default: 0,
    },
    fileReference: {
      csvFileName: { type: String, default: '' },
      pdfFileName: { type: String, default: '' },
      csvData: { type: String, default: '' }, // Cached or referenced
    },
    runBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    runByName: {
      type: String,
      default: 'Safety Specialist',
    },
    runAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    approval: {
      status: {
        type: String,
        enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
        default: 'DRAFT',
      },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      requestedByName: { type: String, default: '' },
      requestedAt: { type: Date, default: null },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      approvedByName: { type: String, default: '' },
      approvedAt: { type: Date, default: null },
      comments: { type: String, default: '' },
    },
    history: {
      type: [reportHistoryItemSchema],
      default: [],
    },
    syntheticNotice: {
      type: String,
      default:
        'Aggregate safety reporting evaluates cumulative population benefit-risk profiles over defined statutory intervals and is fundamentally distinct from expedited individual case safety reports (ICSRs).',
    },
  },
  {
    timestamps: true,
  },
);

reportRunSchema.index({ definitionId: 1, version: 1 });
reportRunSchema.index({ runAt: -1, status: 1 });

export const ReportRun = mongoose.model('ReportRun', reportRunSchema);

