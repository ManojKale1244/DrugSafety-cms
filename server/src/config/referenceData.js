/**
 * Reference Data & Configuration for Drug Safety CMS
 * Includes scoring weights and thresholds for duplicate detection.
 */
export const referenceData = {
  // Duplicate Detection Scoring System Configuration
  duplicateDetection: {
    // Scoring Weights (sums to 100 for a perfect match)
    weights: {
      productMatch: 30, // Suspect medicinal product match
      reactionMatch: 25, // MedDRA PT or verbatim adverse event
      eventDateMatch: 15, // Receipt or event onset date proximity (± N days)
      patientAgeMatch: 10, // Patient age within tolerance
      patientSexMatch: 10, // Patient biological sex match
      reporterMatch: 10, // Reporter identity, organization or contact
    },

    // Matching Tolerances and Thresholds
    thresholds: {
      // Event Date window in days (± N days receives partial credit)
      eventDateWindowDays: 14,

      // Age difference tolerance in years for partial match credit
      ageDifferenceToleranceYears: 3,

      // Levenshtein / Normalized string similarity thresholds (0.0 to 1.0)
      levenshteinProductThreshold: 0.7,
      levenshteinReactionThreshold: 0.65,
      levenshteinReporterThreshold: 0.7,

      // Minimum combined score for a case pair to enter the duplicate queue
      candidateMinScore: 35,

      // Score threshold considered high confidence match
      highConfidenceScore: 75,
    },

    // Decision states
    decisionStates: ['PENDING', 'CONFIRMED_DUPLICATE', 'NOT_DUPLICATE'],
  },
};
