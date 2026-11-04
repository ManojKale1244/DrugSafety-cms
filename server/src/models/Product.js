import mongoose from 'mongoose';

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    strength: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    productCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    genericName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    ingredients: {
      type: [ingredientSchema],
      default: [],
    },
    strength: {
      type: String,
      default: '',
      trim: true,
    },
    dosageForm: {
      type: String,
      default: 'Tablet',
      trim: true,
    },
    route: {
      type: String,
      default: 'Oral',
      trim: true,
    },
    manufacturer: {
      type: String,
      default: '',
      trim: true,
    },
    identifiers: {
      ndc: { type: String, default: '', trim: true },
      atcCode: { type: String, default: '', trim: true, index: true },
      rxNorm: { type: String, default: '', trim: true },
      internalCode: { type: String, default: '', trim: true },
    },
    classification: {
      type: String,
      enum: ['Prescription', 'OTC', 'Investigational', 'Vaccine', 'Biologic'],
      default: 'Prescription',
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'RETIRED', 'INVESTIGATIONAL'],
      default: 'ACTIVE',
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    retiredAt: {
      type: Date,
      default: null,
    },
    retiredReason: {
      type: String,
      default: null,
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

// Auto-assign productCode if not provided
productSchema.pre('save', async function (next) {
  if (!this.productCode) {
    const count = await mongoose.model('Product').countDocuments();
    this.productCode = `PRD-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

export const Product = mongoose.model('Product', productSchema);

