import mongoose from 'mongoose';

const workflowTaskSchema = new mongoose.Schema(
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
      index: true,
    },
    stage: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedToName: {
      type: String,
      default: 'Unassigned',
    },
    dueAt: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completedByName: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for user task queue and stage worklists
workflowTaskSchema.index({ assignedTo: 1, status: 1 });
workflowTaskSchema.index({ stage: 1, status: 1 });

export const WorkflowTask = mongoose.model('WorkflowTask', workflowTaskSchema);

