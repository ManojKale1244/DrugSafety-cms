import mongoose from 'mongoose';

const reportDefinitionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    reportType: {
      type: String,
      enum: ['PSUR', 'PBRER', 'DSUR', 'LINE_LISTING', 'SUMMARY_TABULATION', 'CUSTOM'],
      default: 'PSUR',
      required: true,
      index: true,
    },
    period: {
      periodType: {
        type: String,
        enum: ['CUSTOM', 'ANNUAL', 'SEMI_ANNUAL', 'QUARTERLY', 'MONTHLY', 'LAST_30_DAYS'],
        default: 'QUARTERLY',
      },
      startDate: {
        type: Date,
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
      },
      relativeDays: {
        type: Number,
        default: 90,
      },
    },
    filters: {
      products: {
        type: [String],
        default: [], // empty means all products
      },
      seriousness: {
        type: String,
        enum: ['ALL', 'Serious', 'Non-Serious'],
        default: 'ALL',
      },
      countries: {
        type: [String],
        default: [], // empty means all countries
      },
      preferredTerms: {
        type: [String],
        default: [],
      },
      causality: {
        type: [String],
        default: [],
      },
      stages: {
        type: [String],
        default: [],
      },
      listedness: {
        type: String,
        enum: ['ALL', 'Listed', 'Unlisted'],
        default: 'ALL',
      },
    },
    grouping: {
      type: [String],
      default: ['product', 'preferredTerm', 'seriousness', 'country'],
    },
    schedule: {
      isScheduled: {
        type: Boolean,
        default: false,
      },
      frequency: {
        type: String,
        enum: ['NONE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'],
        default: 'NONE',
      },
      cronExpression: {
        type: String,
        default: '',
      },
      nextRunAt: {
        type: Date,
        default: null,
      },
    },
    format: {
      type: [String],
      default: ['CSV', 'PDF'],
    },
    version: {
      type: Number,
      default: 1,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdByName: {
      type: String,
      default: 'Safety Officer',
    },
    syntheticNotice: {
      type: String,
      default:
        'Aggregate safety reporting definition for periodic benefit-risk assessment (PSUR/PBRER/DSUR). Distinct from expedited ICSRs.',
    },
  },
  {
    timestamps: true,
  },
);

reportDefinitionSchema.index({ name: 1, active: 1 });

export const ReportDefinition = mongoose.model('ReportDefinition', reportDefinitionSchema);

