import * as codingService from '../services/coding.service.js';

/**
 * GET /api/coding/terms?q=...&level=...&limit=...
 * Search medical terms with autocomplete and hierarchy
 */
export async function getTerms(req, res, next) {
  try {
    const { q = '', level, limit = 20 } = req.query;
    const terms = await codingService.searchTerms({ q, level, limit });
    return res.json({
      success: true,
      count: terms.length,
      terms,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/coding/records
 * Assign initial or revised coding for a reaction
 */
export async function createRecord(req, res, next) {
  try {
    const { caseId, reactionId, codedTermId, dictionaryVersion, reason } = req.body;
    const result = await codingService.createCodingRecord({
      caseId,
      reactionId,
      codedTermId,
      dictionaryVersion,
      reason,
      user: req.user,
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'Medical coding record created successfully.',
      codingRecord: result.codingRecord,
      case: result.case,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/coding/records/:id
 * Override or update coding record with mandatory change reason
 */
export async function updateRecord(req, res, next) {
  try {
    const { id } = req.params;
    const { codedTermId, reason, dictionaryVersion } = req.body;
    const updated = await codingService.updateCodingRecord(
      id,
      { codedTermId, reason, dictionaryVersion },
      req.user,
      req,
    );

    return res.json({
      success: true,
      message: 'Medical coding record updated successfully.',
      codingRecord: updated,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/cases/:id/coding
 * Retrieve coding status and auto-suggestions for all reactions in a case
 */
export async function getCaseCoding(req, res, next) {
  try {
    const { id } = req.params;
    const result = await codingService.getCaseCoding(id);
    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

