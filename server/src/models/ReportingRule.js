import mongoose from 'mongoose';

const reportingRuleSchema = new mongoose.Schema(
  {
    ruleCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    jurisdiction: {
      type: String,
      required: true,
      trim: true,
      enum: ['FDA', 'EMA', 'CDSCO', 'PMDA', 'MHRA', 'WHO', 'GLOBAL'],
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    reportType: {
      type: String,
      required: true,
      trim: true,
    },
    conditions: {
      seriousness: {
        type: String,
        enum: ['ANY', 'Serious', 'Non-Serious'],
        default: 'Serious',
      },
      expectedness: {
        type: String,
        enum: ['ANY', 'Unlisted', 'Listed', 'Unknown'],
        default: 'ANY',
      },
      seriousnessCriteria: {
        type: [String],
        default: [], // e.g. ['death', 'lifeThreatening', 'hospitalization']
      },
      country: {
        type: String,
        default: 'ANY',
      },
      causality: {
        type: [String],
        default: ['Related', 'Certain', 'Probable', 'Possible', 'ANY'],
      },
    },
    deadlineDays: {
      type: Number,
      required: true,
      min: 1,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      index: true,
    },
    effectiveFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    changeHistory: {
      type: [
        {
          version: { type: Number, required: true },
          changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
          changedByName: { type: String, default: 'System' },
          changedAt: { type: Date, default: Date.now },
          reason: { type: String, default: '' },
          previousDefinition: { type: mongoose.Schema.Types.Mixed, default: null },
          diff: [
            {
              field: { type: String, required: true },
              label: { type: String, default: '' },
              oldValue: { type: mongoose.Schema.Types.Mixed },
              newValue: { type: mongoose.Schema.Types.Mixed },
            },
          ],
        },
      ],
      default: [],
    },
    approval: {
      status: {
        type: String,
        enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
        default: 'APPROVED',
      },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      requestedByName: { type: String, default: '' },
      requestedAt: { type: Date, default: null },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      approvedByName: { type: String, default: '' },
      approvedAt: { type: Date, default: null },
      rejectionReason: { type: String, default: '' },
    },
    syntheticNotice: {
      type: String,
      default:
        'Synthetic educational rules — validate with regulatory experts and official health authority specifications before clinical or production use.',
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to ensure uniqueness per rule code and version
reportingRuleSchema.index({ ruleCode: 1, version: 1 }, { unique: true });

export const ReportingRule = mongoose.model('ReportingRule', reportingRuleSchema);

