import {
  checkDuplicates,
  getDuplicateQueue,
  getDuplicateReviewById,
  decideDuplicate,
  scoreCasePair,
} from '../services/duplicate.service.js';
import { Case } from '../models/Case.js';
import { referenceData } from '../config/referenceData.js';

/**
 * POST /api/duplicates/check
 * Runs candidate match scoring for a given case ID or case payload.
 */
export async function runDuplicateCheck(req, res, next) {
  try {
    const { sourceCaseId, caseId, caseNumber, product, reaction, eventDate, patient, reporter } =
      req.body;

    const targetId = sourceCaseId || caseId;

    if (targetId) {
      const candidates = await checkDuplicates(targetId);
      return res.json({
        success: true,
        message: `Duplicate check completed. Found ${candidates.length} candidate match(es).`,
        count: candidates.length,
        candidates,
      });
    }

    if (caseNumber) {
      const source = await Case.findOne({ caseNumber: caseNumber.trim().toUpperCase() });
      if (!source) {
        return res.status(404).json({ success: false, error: `Case ${caseNumber} not found` });
      }
      const candidates = await checkDuplicates(source);
      return res.json({
        success: true,
        message: `Duplicate check completed. Found ${candidates.length} candidate match(es).`,
        count: candidates.length,
        candidates,
      });
    }

    // Ad-hoc candidate screening for new submission / intake form payload
    if (product || reaction) {
      const pseudoCase = {
        product: product || '',
        caseProducts: [{ productName: product || '', role: 'Suspect' }],
        eventSummary: reaction || '',
        reactions: [{ verbatim: reaction || '', pt: reaction || '' }],
        receiptDate: eventDate ? new Date(eventDate) : new Date(),
        patient: {
          age: patient?.age != null ? Number(patient.age) : null,
          sex: patient?.sex || 'Unknown',
        },
        reporter: {
          name: reporter?.name || '',
          contact: reporter?.contact || '',
          qualification: reporter?.qualification || 'Physician',
        },
      };

      const allCases = await Case.find().lean();
      const scored = [];
      const { thresholds } = referenceData.duplicateDetection;

      for (const candidate of allCases) {
        const result = scoreCasePair(pseudoCase, candidate);
        if (result.score >= thresholds.candidateMinScore) {
          scored.push({
            candidateCaseId: candidate._id,
            candidateCaseNumber: candidate.caseNumber,
            score: result.score,
            matchedFields: result.matchedFields,
            breakdown: result.breakdown,
          });
        }
      }

      scored.sort((a, b) => b.score - a.score);

      return res.json({
        success: true,
        message: `Pre-submission duplicate screening found ${scored.length} potential match(es).`,
        count: scored.length,
        candidates: scored,
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Please provide either a sourceCaseId, caseNumber, or product/reaction payload to evaluate duplicates.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/duplicates/queue
 * Returns candidate duplicate pairs in descending score order.
 */
export async function getQueue(req, res, next) {
  try {
    const { decision, sortBy = 'score', order = 'desc', page = 1, limit = 50 } = req.query;

    const result = await getDuplicateQueue({
      decision,
      sortBy,
      order,
      page: Number(page),
      limit: Number(limit),
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/duplicates/:id
 * Returns a specific duplicate review record by ID.
 */
export async function getReviewDetails(req, res, next) {
  try {
    const { id } = req.params;
    const review = await getDuplicateReviewById(id);
    return res.json({
      success: true,
      data: review,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/duplicates/:id/decide
 * Records human decision with mandatory justification.
 * If CONFIRMED_DUPLICATE, links cases reciprocally while preserving complete histories.
 */
export async function recordDecision(req, res, next) {
  try {
    const { id } = req.params;
    const { decision, reason } = req.body;

    if (!decision) {
      return res.status(400).json({
        success: false,
        error: "Decision is required ('CONFIRMED_DUPLICATE' or 'NOT_DUPLICATE')",
      });
    }

    if (!['CONFIRMED_DUPLICATE', 'NOT_DUPLICATE'].includes(decision)) {
      return res.status(400).json({
        success: false,
        error: "Invalid decision. Allowed values are 'CONFIRMED_DUPLICATE' or 'NOT_DUPLICATE'",
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'A documented decision reason (minimum 5 characters) is mandatory to comply with pharmacovigilance audit standards.',
      });
    }

    const auditContext = {
      ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'browser',
    };

    const updatedReview = await decideDuplicate(
      id,
      req.user,
      { decision, reason },
      auditContext,
    );

    return res.json({
      success: true,
      message: `Duplicate decision '${decision}' successfully recorded with audit log.`,
      data: updatedReview,
    });
  } catch (err) {
    next(err);
  }
}
