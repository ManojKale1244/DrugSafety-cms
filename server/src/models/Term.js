import mongoose from 'mongoose';

const termSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    level: {
      type: String,
      enum: ['SOC', 'HLGT', 'HLT', 'PT', 'LLT', 'DRUG'],
      required: true,
      index: true,
    },
    parentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Term',
      },
    ],
    dictionaryVersion: {
      type: String,
      default: 'SYN-MedDRA-27.0',
      index: true,
    },
    // Breadcrumb hierarchy chain: [SOC, HLGT, HLT, PT, LLT]
    hierarchy: [
      {
        level: { type: String, required: true },
        code: { type: String, required: true },
        name: { type: String, required: true },
      },
    ],
    // Synthetic WHO-Drug classification metadata
    drugCategory: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for rapid autocomplete and full-text searches
termSchema.index({ name: 'text', code: 'text' });
termSchema.index({ level: 1, name: 1 });

export const Term = mongoose.model('Term', termSchema);

