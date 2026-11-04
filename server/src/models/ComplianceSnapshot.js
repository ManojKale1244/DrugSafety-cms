import mongoose from 'mongoose';

const complianceSnapshotSchema = new mongoose.Schema(
  {
    snapshotDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    period: {
      type: String,
      default: 'ALL_TIME',
    },
    overallMetrics: {
      totalObligations: { type: Number, default: 0 },
      onTimeCount: { type: Number, default: 0 },
      lateCount: { type: Number, default: 0 },
      overdueCount: { type: Number, default: 0 },
      pendingCount: { type: Number, default: 0 },
      onTimeRate: { type: Number, default: 100 }, // Percentage e.g. 96.5
      riskLevel: {
        type: String,
        enum: ['HEALTHY', 'WARNING', 'CRITICAL'],
        default: 'HEALTHY',
      },
    },
    jurisdictionBreakdown: [
      {
        jurisdiction: { type: String, required: true },
        total: { type: Number, default: 0 },
        onTimeCount: { type: Number, default: 0 },
        lateCount: { type: Number, default: 0 },
        overdueCount: { type: Number, default: 0 },
        pendingCount: { type: Number, default: 0 },
        onTimeRate: { type: Number, default: 100 },
        riskLevel: {
          type: String,
          enum: ['HEALTHY', 'WARNING', 'CRITICAL'],
          default: 'HEALTHY',
        },
      },
    ],
    ruleBreakdown: [
      {
        ruleCode: { type: String, required: true },
        ruleName: { type: String, default: '' },
        jurisdiction: { type: String, required: true },
        total: { type: Number, default: 0 },
        onTimeCount: { type: Number, default: 0 },
        overdueCount: { type: Number, default: 0 },
        onTimeRate: { type: Number, default: 100 },
        activeVersion: { type: Number, default: 1 },
      },
    ],
    upcomingDeadlines: {
      within7Days: { type: Number, default: 0 },
      within15Days: { type: Number, default: 0 },
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    syntheticNotice: {
      type: String,
      default:
        'Synthetic educational compliance metrics — computed from simulated case submissions and synthetic statutory reporting rules.',
    },
  },
  {
    timestamps: true,
  },
);

export const ComplianceSnapshot = mongoose.model('ComplianceSnapshot', complianceSnapshotSchema);

