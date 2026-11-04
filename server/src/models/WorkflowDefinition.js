import mongoose from 'mongoose';

const transitionSchema = new mongoose.Schema(
  {
    from: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    to: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    allowedRoles: {
      type: [String],
      default: ['admin', 'case_manager'],
    },
    requiredChecks: {
      type: [String],
      default: [],
    },
    requiresReason: {
      type: Boolean,
      default: false,
    },
    isBackward: {
      type: Boolean,
      default: false,
    },
    label: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: true },
);

const workflowDefinitionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: 'Standard PV ICSR Workflow',
    },
    description: {
      type: String,
      default: 'ICH E2D and 21 CFR Part 11 compliant standard pharmacovigilance safety lifecycle',
    },
    isDefault: {
      type: Boolean,
      default: true,
      index: true,
    },
    stages: {
      type: [String],
      required: true,
      default: [
        'NEW',
        'DATA_ENTRY',
        'MEDICAL_CODING',
        'MEDICAL_REVIEW',
        'QUALITY_REVIEW',
        'REGULATORY_REPORTING',
        'FINAL_REVIEW',
        'CLOSED',
      ],
    },
    transitions: {
      type: [transitionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const WorkflowDefinition = mongoose.model('WorkflowDefinition', workflowDefinitionSchema);

