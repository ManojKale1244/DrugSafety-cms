import * as caseService from '../services/case.service.js';
import { ConflictError, ValidationError, ForbiddenError } from '../services/case.service.js';

export async function createCaseHandler(req, res, next) {
  try {
    const caseDoc = await caseService.createCase(req.body, req.user);
    return res.status(201).json({
      success: true,
      case: caseDoc,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ success: false, error: err.message, details: err.details });
    }
    next(err);
  }
}

export async function getCasesHandler(req, res, next) {
  try {
    const result = await caseService.getCases(req.query, req.user);
    return res.json({
      success: true,
      cases: result.cases,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
}

export async function getCaseByIdHandler(req, res, next) {
  try {
    const caseDoc = await caseService.getCaseById(req.params.id);
    if (!caseDoc) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    const readiness = caseService.validateCaseClosureReadiness(caseDoc);

    return res.json({
      success: true,
      case: caseDoc,
      closureReadiness: readiness,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCaseHandler(req, res, next) {
  try {
    const updatedCase = await caseService.updateCase(req.params.id, req.body, req.user);
    if (!updatedCase) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    return res.json({
      success: true,
      case: updatedCase,
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      return res.status(409).json({
        success: false,
        error: err.message,
        isConflict: true,
        currentCase: err.currentCase,
      });
    }
    if (err instanceof ForbiddenError) {
      return res.status(403).json({ success: false, error: err.message });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ success: false, error: err.message, details: err.details });
    }
    next(err);
  }
}

export async function assignCaseHandler(req, res, next) {
  try {
    const { assignedTo, reason } = req.body;
    const caseDoc = await caseService.assignCase(req.params.id, assignedTo, reason, req.user);
    if (!caseDoc) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    return res.json({
      success: true,
      case: caseDoc,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err instanceof ForbiddenError) {
      return res.status(403).json({ success: false, error: err.message });
    }
    next(err);
  }
}

export async function closeCaseHandler(req, res, next) {
  try {
    const { closureReason } = req.body;
    const caseDoc = await caseService.closeCase(req.params.id, closureReason, req.user);
    if (!caseDoc) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }

    return res.json({
      success: true,
      case: caseDoc,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: err.message,
        missingRequirements: err.details,
      });
    }
    next(err);
  }
}

export async function getCaseHistoryHandler(req, res, next) {
  try {
    const history = await caseService.getCaseHistory(req.params.id);
    return res.json({
      success: true,
      history,
    });
  } catch (err) {
    next(err);
  }
}

export async function exportCasesCsvHandler(req, res, next) {
  try {
    const csvData = await caseService.exportCasesToCsv(req.query, req.user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=safety-cases-${Date.now()}.csv`);
    return res.status(200).send(csvData);
  } catch (err) {
    next(err);
  }
}
