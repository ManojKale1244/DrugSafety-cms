import mongoose from 'mongoose';

const auditEventSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorEmail: {
      type: String,
      default: 'system',
    },
    actorRole: {
      type: String,
      default: 'system',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entity: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      default: null,
      index: true,
    },
    summary: {
      type: String,
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: 'unknown',
    },
    userAgent: {
      type: String,
      default: 'unknown',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  },
);

// Prevent modifications to maintain immutability
auditEventSchema.pre('updateOne', function () {
  throw new Error('Audit events are immutable and cannot be updated');
});
auditEventSchema.pre('findOneAndUpdate', function () {
  throw new Error('Audit events are immutable and cannot be updated');
});
auditEventSchema.pre('deleteOne', function () {
  throw new Error('Audit events are immutable and cannot be deleted');
});
auditEventSchema.pre('findOneAndDelete', function () {
  throw new Error('Audit events are immutable and cannot be deleted');
});

export const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);
