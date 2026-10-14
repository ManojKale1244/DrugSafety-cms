import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    productName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['Suspect', 'Concomitant', 'Interacting'],
      default: 'Suspect',
    },
    dose: { type: String, default: '' },
    frequency: { type: String, default: '' },
    route: { type: String, default: '' },
    indication: { type: String, default: '' },
    startDate: { type: Date, default: null },
    stopDate: { type: Date, default: null },
    lotNumber: { type: String, default: '' },
    expirationDate: { type: Date, default: null },
  },
  { _id: true },
);

const reactionSchema = new mongoose.Schema(
  {
    verbatim: { type: String, required: true, trim: true },
    pt: { type: String, default: '', trim: true }, // MedDRA Preferred Term
    soc: { type: String, default: '', trim: true }, // System Organ Class
    meddraCode: { type: String, default: '' },
    startDate: { type: Date, default: null },
    stopDate: { type: Date, default: null },
    outcome: {
      type: String,
      enum: ['recovered', 'recovering', 'not_recovered', 'fatal', 'unknown'],
      default: 'unknown',
    },
    causality: {
      type: String,
      enum: ['Certain', 'Probable', 'Possible', 'Unlikely', 'Unclassifiable', 'Not Assessed'],
      default: 'Not Assessed',
    },
  },
  { _id: true },
);

const caseSchema = new mongoose.Schema(
  {
    caseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'new',
        'triage',
        'data_entry',
        'medical_review',
        'quality_review',
        'ready_for_submission',
        'submitted',
        'completed',
        'closed',
      ],
      default: 'new',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    receiptDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    initialReceiptDate: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      enum: [
        'physician',
        'patient',
        'literature',
        'regulator',
        'company_representative',
        'study',
        'other',
        'Spontaneous',
        'Clinical Trial',
        'Post-Marketing',
        'Health Authority',
      ],
      default: 'physician',
      index: true,
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    regulatoryDueDate: {
      type: Date,
      default: null,
      index: true,
    },

    // ── Patient Details ──────────────────────────────────────
    patient: {
      reference: { type: String, default: '', trim: true },
      age: { type: Number, default: null },
      ageUnit: { type: String, enum: ['years', 'months', 'days'], default: 'years' },
      sex: { type: String, enum: ['Male', 'Female', 'Other', 'Unknown'], default: 'Unknown' },
      weight: { type: Number, default: null },
      weightUnit: { type: String, enum: ['kg', 'lbs'], default: 'kg' },
      history: { type: String, default: '' },
    },

    // ── Reporter Details ─────────────────────────────────────
    reporter: {
      name: { type: String, default: '', trim: true },
      qualification: { type: String, default: 'Physician', trim: true },
      contact: { type: String, default: '', trim: true },
      country: { type: String, default: 'India', trim: true },
      organization: { type: String, default: '', trim: true },
    },

    // ── Medicinal Products & Adverse Reactions ──────────────
    caseProducts: {
      type: [productSchema],
      default: [],
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },

    // ── Clinical Narrative ──────────────────────────────────
    narrative: {
      type: String,
      default: '',
    },

    // ── Seriousness Classification ───────────────────────────
    seriousness: {
      type: String,
      enum: ['Serious', 'Non-Serious'],
      default: 'Non-Serious',
      index: true,
    },
    seriousnessFlags: {
      isSerious: { type: Boolean, default: false },
      death: { type: Boolean, default: false },
      lifeThreatening: { type: Boolean, default: false },
      hospitalization: { type: Boolean, default: false },
      disability: { type: Boolean, default: false },
      congenitalAnomaly: { type: Boolean, default: false },
      otherMedicallyImportant: { type: Boolean, default: false },
    },

    // ── Medical & Causality Assessment ──────────────────────
    assessment: {
      companyCausality: {
        type: String,
        enum: ['Related', 'Not Related', 'Unassessed'],
        default: 'Unassessed',
      },
      listedness: {
        type: String,
        enum: ['Listed', 'Unlisted', 'Unknown'],
        default: 'Unknown',
      },
      medicalReviewerComments: { type: String, default: '' },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
    },

    // ── Workflow Progress & Quality Checklist ───────────────
    workflow: {
      triageCompleted: { type: Boolean, default: false },
      dataEntryCompleted: { type: Boolean, default: false },
      medicalReviewCompleted: { type: Boolean, default: false },
      qualityReviewCompleted: { type: Boolean, default: false },
    },

    // ── Optimistic Concurrency Control ──────────────────────
    version: {
      type: Number,
      default: 1,
      required: true,
    },

    // ── Closure Information ─────────────────────────────────
    closedAt: {
      type: Date,
      default: null,
    },
    closureReason: {
      type: String,
      default: null,
    },

    // ── Legacy Compatibility Fields ─────────────────────────
    product: {
      type: String,
      default: 'Medicine A',
      trim: true,
      index: true,
    },
    eventSummary: {
      type: String,
      default: 'Adverse event report',
      trim: true,
    },
    reportType: {
      type: String,
      default: 'Spontaneous',
    },
    patientAge: {
      type: Number,
      default: null,
    },
    patientGender: {
      type: String,
      default: 'Unknown',
    },
  },
  {
    timestamps: true,
  },
);

// Synchronize legacy summary fields before saving
caseSchema.pre('save', function (next) {
  // Sync products
  if (this.caseProducts && this.caseProducts.length > 0) {
    const suspect = this.caseProducts.find((p) => p.role === 'Suspect') || this.caseProducts[0];
    if (suspect?.productName) {
      this.product = suspect.productName;
    }
  } else if (this.product && (!this.caseProducts || this.caseProducts.length === 0)) {
    this.caseProducts = [
      {
        productName: this.product,
        role: 'Suspect',
      },
    ];
  }

  // Sync reactions
  if (this.reactions && this.reactions.length > 0) {
    const summaries = this.reactions.map((r) => r.pt || r.verbatim).filter(Boolean);
    if (summaries.length > 0) {
      this.eventSummary = summaries.join('; ');
    }
  } else if (this.eventSummary && (!this.reactions || this.reactions.length === 0)) {
    this.reactions = [
      {
        verbatim: this.eventSummary,
        pt: this.eventSummary,
      },
    ];
  }

  // Sync patient info
  if (this.patient) {
    if (this.patient.age != null) this.patientAge = this.patient.age;
    if (this.patient.sex) this.patientGender = this.patient.sex;
  }

  // Sync seriousness enum <-> flags
  const hasSpecificSeriousFlag =
    this.seriousnessFlags &&
    (this.seriousnessFlags.death ||
      this.seriousnessFlags.lifeThreatening ||
      this.seriousnessFlags.hospitalization ||
      this.seriousnessFlags.disability ||
      this.seriousnessFlags.congenitalAnomaly ||
      this.seriousnessFlags.otherMedicallyImportant ||
      this.seriousnessFlags.isSerious);

  if (hasSpecificSeriousFlag || this.seriousness === 'Serious') {
    this.seriousness = 'Serious';
    if (!this.seriousnessFlags) {
      this.seriousnessFlags = {};
    }
    this.seriousnessFlags.isSerious = true;
  } else {
    this.seriousness = 'Non-Serious';
    if (this.seriousnessFlags) {
      this.seriousnessFlags.isSerious = false;
    }
  }

  next();
});

export const Case = mongoose.model('Case', caseSchema);
