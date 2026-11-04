import { referenceData } from '../config/referenceData.js';
import { Case } from '../models/Case.js';
import { DuplicateReview } from '../models/DuplicateReview.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { logger } from '../utils/logger.js';

/**
 * Calculates Levenshtein edit distance between two strings.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} Distance
 */
export function calculateLevenshteinDistance(a = '', b = '') {
  const str1 = String(a || '').toLowerCase().trim();
  const str2 = String(b || '').toLowerCase().trim();

  if (str1 === str2) return 0;
  if (!str1.length) return str2.length;
  if (!str2.length) return str1.length;

  const row = [];
  for (let i = 0; i <= str2.length; i++) {
    row[i] = i;
  }

  for (let i = 1; i <= str1.length; i++) {
    let prev = i;
    for (let j = 1; j <= str2.length; j++) {
      let val;
      if (str1[i - 1] === str2[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[str2.length] = prev;
  }

  return row[str2.length];
}

/**
 * Calculates normalized string similarity (0.0 to 1.0) using Levenshtein distance
 * and token/substring overlap checks.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} Similarity score between 0.0 and 1.0
 */
export function calculateStringSimilarity(a = '', b = '') {
  const str1 = String(a || '').toLowerCase().trim();
  const str2 = String(b || '').toLowerCase().trim();

  if (!str1 && !str2) return 1.0;
  if (!str1 || !str2) return 0.0;
  if (str1 === str2) return 1.0;

  // Substring inclusion bonus
  if (str1.includes(str2) || str2.includes(str1)) {
    const minLen = Math.min(str1.length, str2.length);
    const maxLen = Math.max(str1.length, str2.length);
    const ratio = minLen / maxLen;
    return Math.max(0.85, ratio);
  }

  const distance = calculateLevenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Extracts a normalized product name from a Case entity.
 *
 * @param {Object} c Case document
 * @returns {string} Product name
 */
export function extractProductName(c) {
  if (c.caseProducts && c.caseProducts.length > 0) {
    const suspect = c.caseProducts.find((p) => p.role === 'Suspect') || c.caseProducts[0];
    if (suspect?.productName) return suspect.productName.trim();
  }
  return (c.product || '').trim();
}

/**
 * Extracts reaction terms (PTs and verbatims) from a Case entity.
 *
 * @param {Object} c Case document
 * @returns {Array<string>} List of reaction strings
 */
export function extractReactionTerms(c) {
  const terms = [];
  if (c.reactions && c.reactions.length > 0) {
    for (const r of c.reactions) {
      if (r.pt) terms.push(r.pt.trim());
      if (r.verbatim && (!r.pt || r.pt.toLowerCase() !== r.verbatim.toLowerCase())) {
        terms.push(r.verbatim.trim());
      }
    }
  }
  if (terms.length === 0 && c.eventSummary) {
    terms.push(c.eventSummary.trim());
  }
  return terms.filter(Boolean);
}

/**
 * Extracts event/receipt date from a Case entity.
 *
 * @param {Object} c Case document
 * @returns {Date|null}
 */
export function extractEventDate(c) {
  if (c.reactions && c.reactions.length > 0) {
    const rxDate = c.reactions.find((r) => r.startDate)?.startDate;
    if (rxDate) return new Date(rxDate);
  }
  if (c.receiptDate) return new Date(c.receiptDate);
  if (c.initialReceiptDate) return new Date(c.initialReceiptDate);
  if (c.createdAt) return new Date(c.createdAt);
  return null;
}

/**
 * Evaluates candidate match between two safety cases using deterministic rules first,
 * followed by Levenshtein fuzzy matching.
 *
 * Weights and thresholds live in referenceData.
 *
 * @param {Object} source
 * @param {Object} candidate
 * @returns {{ score: number, matchedFields: string[], breakdown: Object }}
 */
export function scoreCasePair(source, candidate) {
  const { weights, thresholds } = referenceData.duplicateDetection;
  const matchedFields = [];
  const breakdown = {};

  // ── 1. Suspected Medicinal Product ────────────────────────
  const sourceProduct = extractProductName(source);
  const candProduct = extractProductName(candidate);

  let productScore = 0;
  let productMatchType = 'different';

  if (sourceProduct && candProduct) {
    if (sourceProduct.toLowerCase() === candProduct.toLowerCase()) {
      // Deterministic exact match
      productScore = weights.productMatch;
      productMatchType = 'exact';
      matchedFields.push('Suspected Product');
    } else {
      // Fuzzy matching via Levenshtein
      const similarity = calculateStringSimilarity(sourceProduct, candProduct);
      if (similarity >= thresholds.levenshteinProductThreshold) {
        productScore = Math.round(weights.productMatch * similarity);
        productMatchType = 'fuzzy';
        matchedFields.push('Suspected Product (Fuzzy)');
      }
    }
  }

  breakdown.product = {
    sourceValue: sourceProduct || 'N/A',
    candidateValue: candProduct || 'N/A',
    matchType: productMatchType,
    score: productScore,
    maxScore: weights.productMatch,
  };

  // ── 2. Adverse Reaction Term / MedDRA PT ──────────────────
  const sourceReactions = extractReactionTerms(source);
  const candReactions = extractReactionTerms(candidate);

  let reactionScore = 0;
  let reactionMatchType = 'different';
  let bestSim = 0;

  if (sourceReactions.length > 0 && candReactions.length > 0) {
    // Check for exact match first (deterministic)
    const exactMatch = sourceReactions.some((sTerm) =>
      candReactions.some((cTerm) => sTerm.toLowerCase() === cTerm.toLowerCase()),
    );

    if (exactMatch) {
      reactionScore = weights.reactionMatch;
      reactionMatchType = 'exact';
      matchedFields.push('Adverse Reaction Term');
    } else {
      // Fuzzy reaction matching
      for (const sTerm of sourceReactions) {
        for (const cTerm of candReactions) {
          const sim = calculateStringSimilarity(sTerm, cTerm);
          if (sim > bestSim) bestSim = sim;
        }
      }

      if (bestSim >= thresholds.levenshteinReactionThreshold) {
        reactionScore = Math.round(weights.reactionMatch * bestSim);
        reactionMatchType = 'fuzzy';
        matchedFields.push('Adverse Reaction Term (Fuzzy)');
      }
    }
  }

  breakdown.reaction = {
    sourceValue: sourceReactions.join('; ') || source.eventSummary || 'N/A',
    candidateValue: candReactions.join('; ') || candidate.eventSummary || 'N/A',
    matchType: reactionMatchType,
    score: reactionScore,
    maxScore: weights.reactionMatch,
    similarity: reactionMatchType === 'fuzzy' ? Math.round(bestSim * 100) : null,
  };

  // ── 3. Event / Receipt Date Proximity ─────────────────────
  const sourceDate = extractEventDate(source);
  const candDate = extractEventDate(candidate);

  let dateScore = 0;
  let dateMatchType = 'different';
  let daysDiff = null;

  if (sourceDate && candDate && !isNaN(sourceDate.getTime()) && !isNaN(candDate.getTime())) {
    const msDiff = Math.abs(sourceDate.getTime() - candDate.getTime());
    daysDiff = Math.round(msDiff / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      dateScore = weights.eventDateMatch;
      dateMatchType = 'exact';
      matchedFields.push('Event Date');
    } else if (daysDiff <= thresholds.eventDateWindowDays) {
      // Linear proximity scaling
      const proximityFactor = 1 - daysDiff / thresholds.eventDateWindowDays;
      dateScore = Math.max(2, Math.round(weights.eventDateMatch * proximityFactor));
      dateMatchType = 'close';
      matchedFields.push(`Event Date (±${daysDiff}d)`);
    }
  }

  breakdown.eventDate = {
    sourceValue: sourceDate ? sourceDate.toISOString().slice(0, 10) : 'N/A',
    candidateValue: candDate ? candDate.toISOString().slice(0, 10) : 'N/A',
    matchType: dateMatchType,
    daysDifference: daysDiff,
    score: dateScore,
    maxScore: weights.eventDateMatch,
  };

  // ── 4. Patient Biological Sex ─────────────────────────────
  const sSex = source.patient?.sex || source.patientGender;
  const cSex = candidate.patient?.sex || candidate.patientGender;

  let sexScore = 0;
  let sexMatchType = 'different';

  if (
    sSex &&
    cSex &&
    sSex !== 'Unknown' &&
    cSex !== 'Unknown' &&
    sSex.toLowerCase() === cSex.toLowerCase()
  ) {
    sexScore = weights.patientSexMatch;
    sexMatchType = 'exact';
    matchedFields.push('Patient Sex');
  } else if (!sSex || !cSex || sSex === 'Unknown' || cSex === 'Unknown') {
    sexMatchType = 'unknown';
  }

  breakdown.patientSex = {
    sourceValue: sSex || 'Unknown',
    candidateValue: cSex || 'Unknown',
    matchType: sexMatchType,
    score: sexScore,
    maxScore: weights.patientSexMatch,
  };

  // ── 5. Patient Age ────────────────────────────────────────
  const sAge = source.patient?.age != null ? source.patient.age : source.patientAge;
  const cAge = candidate.patient?.age != null ? candidate.patient.age : candidate.patientAge;

  let ageScore = 0;
  let ageMatchType = 'different';
  let ageDiff = null;

  if (sAge != null && cAge != null && !isNaN(sAge) && !isNaN(cAge)) {
    ageDiff = Math.abs(sAge - cAge);
    if (ageDiff === 0) {
      ageScore = weights.patientAgeMatch;
      ageMatchType = 'exact';
      matchedFields.push('Patient Age');
    } else if (ageDiff <= thresholds.ageDifferenceToleranceYears) {
      const scale = 1 - ageDiff / (thresholds.ageDifferenceToleranceYears + 1);
      ageScore = Math.max(2, Math.round(weights.patientAgeMatch * scale));
      ageMatchType = 'close';
      matchedFields.push(`Patient Age (±${ageDiff}y)`);
    }
  } else {
    ageMatchType = 'unknown';
  }

  breakdown.patientAge = {
    sourceValue: sAge != null ? `${sAge} yrs` : 'N/A',
    candidateValue: cAge != null ? `${cAge} yrs` : 'N/A',
    matchType: ageMatchType,
    ageDifference: ageDiff,
    score: ageScore,
    maxScore: weights.patientAgeMatch,
  };

  // ── 6. Reporter Information ───────────────────────────────
  const sRepName = (source.reporter?.name || '').trim();
  const cRepName = (candidate.reporter?.name || '').trim();
  const sRepContact = (source.reporter?.contact || '').trim();
  const cRepContact = (candidate.reporter?.contact || '').trim();

  let repScore = 0;
  let repMatchType = 'different';

  if (sRepName && cRepName) {
    if (sRepName.toLowerCase() === cRepName.toLowerCase()) {
      repScore = weights.reporterMatch;
      repMatchType = 'exact';
      matchedFields.push('Reporter Name');
    } else {
      const repSim = calculateStringSimilarity(sRepName, cRepName);
      if (repSim >= thresholds.levenshteinReporterThreshold) {
        repScore = Math.round(weights.reporterMatch * repSim);
        repMatchType = 'fuzzy';
        matchedFields.push('Reporter Name (Fuzzy)');
      }
    }
  } else if (sRepContact && cRepContact && sRepContact.toLowerCase() === cRepContact.toLowerCase()) {
    repScore = weights.reporterMatch;
    repMatchType = 'exact';
    matchedFields.push('Reporter Contact');
  }

  breakdown.reporter = {
    sourceValue: sRepName ? `${sRepName} (${source.reporter?.qualification || 'Physician'})` : 'N/A',
    candidateValue: cRepName ? `${cRepName} (${candidate.reporter?.qualification || 'Physician'})` : 'N/A',
    matchType: repMatchType,
    score: repScore,
    maxScore: weights.reporterMatch,
  };

  // ── Total Score ───────────────────────────────────────────
  const totalScore = Math.min(
    100,
    productScore + reactionScore + dateScore + sexScore + ageScore + repScore,
  );

  return {
    score: totalScore,
    matchedFields,
    breakdown,
  };
}

/**
 * Executes candidate match search for a specific source case against all other cases in the system.
 * Creates or updates DuplicateReview records with 'PENDING' decision for candidates >= candidateMinScore.
 *
 * @param {string|Object} sourceCaseIdOrCase
 * @returns {Promise<Array<Object>>} Scored candidate list
 */
export async function checkDuplicates(sourceCaseIdOrCase) {
  let sourceCase;
  if (typeof sourceCaseIdOrCase === 'string' || sourceCaseIdOrCase?._id) {
    sourceCase = await Case.findById(sourceCaseIdOrCase._id || sourceCaseIdOrCase);
  } else {
    sourceCase = sourceCaseIdOrCase;
  }

  if (!sourceCase) {
    throw new Error('Source case not found for duplicate screening');
  }

  const { thresholds } = referenceData.duplicateDetection;

  // Find all other cases
  const allOtherCases = await Case.find({
    _id: { $ne: sourceCase._id },
  }).lean();

  const candidates = [];

  for (const candidate of allOtherCases) {
    const { score, matchedFields, breakdown } = scoreCasePair(sourceCase, candidate);

    if (score >= thresholds.candidateMinScore) {
      // Upsert DuplicateReview record
      const existing = await DuplicateReview.findOne({
        sourceId: sourceCase._id,
        candidateCaseId: candidate._id,
      });

      let review;
      if (existing) {
        // Only update score/breakdown if still PENDING; preserve human decision if already decided
        if (existing.decision === 'PENDING') {
          existing.score = score;
          existing.matchedFields = matchedFields;
          existing.breakdown = breakdown;
          existing.sourceCaseNumber = sourceCase.caseNumber;
          existing.candidateCaseNumber = candidate.caseNumber;
          await existing.save();
        }
        review = existing;
      } else {
        review = await DuplicateReview.create({
          sourceId: sourceCase._id,
          candidateCaseId: candidate._id,
          sourceCaseNumber: sourceCase.caseNumber,
          candidateCaseNumber: candidate.caseNumber,
          score,
          matchedFields,
          breakdown,
          decision: 'PENDING',
        });
      }

      candidates.push({
        reviewId: review._id,
        candidateCaseId: candidate._id,
        candidateCaseNumber: candidate.caseNumber,
        score,
        matchedFields,
        decision: review.decision,
        breakdown,
      });
    }
  }

  // Sort descending by score
  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Retrieves the duplicate review queue, sorted by similarity score descending.
 *
 * @param {Object} options
 * @param {string} [options.decision] Optional decision filter
 * @param {string} [options.sortBy='score'] Sort field
 * @param {string} [options.order='desc'] Sort order ('asc'|'desc')
 * @param {number} [options.page=1]
 * @param {number} [options.limit=50]
 * @returns {Promise<{ data: Array, total: number, stats: Object }>}
 */
export async function getDuplicateQueue({
  decision,
  sortBy = 'score',
  order = 'desc',
  page = 1,
  limit = 50,
} = {}) {
  const query = {};
  if (decision && referenceData.duplicateDetection.decisionStates.includes(decision)) {
    query.decision = decision;
  }

  const sortOrder = order === 'asc' ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  const skip = (Math.max(1, page) - 1) * Math.max(1, limit);

  const [items, total, pendingCount, confirmedCount, notDuplicateCount] = await Promise.all([
    DuplicateReview.find(query)
      .populate('sourceId', 'caseNumber product eventSummary patient reporter receiptDate status priority caseProducts reactions')
      .populate('candidateCaseId', 'caseNumber product eventSummary patient reporter receiptDate status priority caseProducts reactions')
      .populate('decidedBy', 'name email role')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    DuplicateReview.countDocuments(query),
    DuplicateReview.countDocuments({ decision: 'PENDING' }),
    DuplicateReview.countDocuments({ decision: 'CONFIRMED_DUPLICATE' }),
    DuplicateReview.countDocuments({ decision: 'NOT_DUPLICATE' }),
  ]);

  return {
    data: items,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      total,
      pending: pendingCount,
      confirmed: confirmedCount,
      notDuplicate: notDuplicateCount,
    },
  };
}

/**
 * Fetches a single duplicate review by ID with populated case details.
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function getDuplicateReviewById(id) {
  const review = await DuplicateReview.findById(id)
    .populate('sourceId')
    .populate('candidateCaseId')
    .populate('decidedBy', 'name email role')
    .lean();

  if (!review) {
    throw new Error('Duplicate review record not found');
  }

  return review;
}

/**
 * Records a human decision for a candidate duplicate pair.
 * NEVER auto-merges or auto-dismisses.
 * Merging creates a linked-case record and preserves both histories.
 *
 * @param {string} reviewId
 * @param {Object} user Current authenticated user
 * @param {Object} payload
 * @param {'CONFIRMED_DUPLICATE'|'NOT_DUPLICATE'} payload.decision
 * @param {string} payload.reason Mandatory reason/justification
 * @param {Object} [auditContext] IP and user agent info
 * @returns {Promise<Object>} Updated DuplicateReview
 */
export async function decideDuplicate(reviewId, user, { decision, reason }, auditContext = {}) {
  if (!user || !user._id) {
    throw new Error('Authentication required: a qualified human reviewer must decide duplicates');
  }

  if (!['CONFIRMED_DUPLICATE', 'NOT_DUPLICATE'].includes(decision)) {
    throw new Error("Invalid decision. Allowed values are 'CONFIRMED_DUPLICATE' or 'NOT_DUPLICATE'");
  }

  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason || trimmedReason.length < 5) {
    throw new Error('A documented clinical/regulatory reason (minimum 5 characters) is required for compliance audit trails');
  }

  const review = await DuplicateReview.findById(reviewId);
  if (!review) {
    throw new Error('Duplicate review record not found');
  }

  const sourceCase = await Case.findById(review.sourceId);
  const candidateCase = await Case.findById(review.candidateCaseId);

  if (!sourceCase || !candidateCase) {
    throw new Error('One or both associated cases could not be located in the repository');
  }

  // Record human decision on DuplicateReview
  review.decision = decision;
  review.reason = trimmedReason;
  review.decidedBy = user._id;
  review.decidedAt = new Date();
  await review.save();

  // If Confirmed Duplicate, link both cases reciprocally to preserve complete history
  if (decision === 'CONFIRMED_DUPLICATE') {
    // 1. Link Candidate to Source Case
    const alreadyLinkedSource = sourceCase.linkedCases?.some(
      (l) => l.caseId?.toString() === candidateCase._id.toString(),
    );
    if (!alreadyLinkedSource) {
      if (!sourceCase.linkedCases) sourceCase.linkedCases = [];
      sourceCase.linkedCases.push({
        caseId: candidateCase._id,
        caseNumber: candidateCase.caseNumber,
        linkType: 'CONFIRMED_DUPLICATE',
        linkedAt: new Date(),
        linkedBy: user._id,
        reason: trimmedReason,
      });
      await sourceCase.save();
    }

    // 2. Link Source to Candidate Case
    const alreadyLinkedCand = candidateCase.linkedCases?.some(
      (l) => l.caseId?.toString() === sourceCase._id.toString(),
    );
    if (!alreadyLinkedCand) {
      if (!candidateCase.linkedCases) candidateCase.linkedCases = [];
      candidateCase.linkedCases.push({
        caseId: sourceCase._id,
        caseNumber: sourceCase.caseNumber,
        linkType: 'CONFIRMED_DUPLICATE',
        linkedAt: new Date(),
        linkedBy: user._id,
        reason: trimmedReason,
      });
      await candidateCase.save();
    }

    logger.info(
      `✓ Linked duplicate cases ${sourceCase.caseNumber} <-> ${candidateCase.caseNumber} with decision reason: ${trimmedReason}`,
    );
  }

  // ── Immutable Audit Trail Event ───────────────────────────
  try {
    await AuditEvent.create({
      actorId: user._id,
      actorEmail: user.email || 'unknown',
      actorRole: user.role || 'reviewer',
      action: decision === 'CONFIRMED_DUPLICATE' ? 'DUPLICATE_MERGE_CONFIRMED' : 'DUPLICATE_DISMISSED',
      entity: 'DuplicateReview',
      entityId: review._id.toString(),
      summary: `Duplicate review decided as ${decision} for cases ${sourceCase.caseNumber} & ${candidateCase.caseNumber}`,
      details: {
        reviewId: review._id,
        sourceCaseId: sourceCase._id,
        sourceCaseNumber: sourceCase.caseNumber,
        candidateCaseId: candidateCase._id,
        candidateCaseNumber: candidateCase.caseNumber,
        score: review.score,
        decision,
        reason: trimmedReason,
        decidedBy: user.email,
        decidedAt: review.decidedAt,
      },
      ip: auditContext.ip || '127.0.0.1',
      userAgent: auditContext.userAgent || 'system',
      timestamp: new Date(),
    });
  } catch (auditErr) {
    logger.error({ auditErr }, 'Failed to record audit event for duplicate decision');
  }

  return review;
}
