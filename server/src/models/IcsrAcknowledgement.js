import mongoose from 'mongoose';

const icsrAcknowledgementSchema = new mongoose.Schema(
  {
    ackId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IcsrMessage',
      required: true,
      index: true,
    },
    transmissionId: {
      type: String,
      required: true,
      index: true,
    },
    ackCode: {
      type: String,
      enum: ['ACK_OK', 'ACK_ERR'],
      default: 'ACK_OK',
      index: true,
    },
    ackPayload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: 'Gateway synthetic transmission acknowledgment received successfully.',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const IcsrAcknowledgement = mongoose.model('IcsrAcknowledgement', icsrAcknowledgementSchema);

