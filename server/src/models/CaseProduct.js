import mongoose from 'mongoose';

const caseProductSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    genericName: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      enum: ['SUSPECT', 'CONCOMITANT', 'INTERACTING', 'Suspect', 'Concomitant', 'Interacting'],
      default: 'SUSPECT',
      index: true,
    },
    dose: {
      type: String,
      default: '',
      trim: true,
    },
    frequency: {
      type: String,
      default: '',
      trim: true,
    },
    route: {
      type: String,
      default: '',
      trim: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    stopDate: {
      type: Date,
      default: null,
    },
    indication: {
      type: String,
      default: '',
      trim: true,
    },
    actionTaken: {
      type: String,
      enum: [
        'DRUG_WITHDRAWN',
        'DOSE_REDUCED',
        'DOSE_INCREASED',
        'DOSE_NOT_CHANGED',
        'NOT_APPLICABLE',
        'UNKNOWN',
      ],
      default: 'UNKNOWN',
    },
    lotNumber: {
      type: String,
      default: '',
      trim: true,
    },
    expirationDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Date validation: stopDate cannot be earlier than startDate
caseProductSchema.pre('save', function (next) {
  if (this.startDate && this.stopDate && new Date(this.stopDate) < new Date(this.startDate)) {
    return next(new Error('Stop date cannot be earlier than start date.'));
  }
  next();
});

export const CaseProduct = mongoose.model('CaseProduct', caseProductSchema);

