import mongoose from 'mongoose';

const checklistItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      default: 'General Quality',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'MAJOR', 'MINOR'],
      default: 'MAJOR',
    },
    targetField: {
      type: String,
      default: 'overview',
      trim: true,
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true },
);

const checklistTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Standard ICSR Quality Review Checklist',
    },
    version: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: true,
      index: true,
    },
    description: {
      type: String,
      default: '21 CFR Part 11 and ICH E2D compliant Quality Review checklist for ICSR verification',
    },
    items: {
      type: [checklistItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export const ChecklistTemplate = mongoose.model('ChecklistTemplate', checklistTemplateSchema);

