import * as aggregateService from '../services/aggregateReport.service.js';

/**
 * GET /api/aggregate-reports/definitions
 */
export async function getDefinitionsHandler(req, res, next) {
  try {
    const definitions = await aggregateService.getReportDefinitions();
    res.json({
      success: true,
      data: definitions,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/aggregate-reports/definitions
 */
export async function createDefinitionHandler(req, res, next) {
  try {
    const definition = await aggregateService.createReportDefinition(req.body, req.user, req);
    res.status(201).json({
      success: true,
      data: definition,
      message: `Report definition ${definition.name} created.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/aggregate-reports/preview
 */
export async function previewReportHandler(req, res, next) {
  try {
    const preview = await aggregateService.previewAggregateReport(req.body);
    res.json({
      success: true,
      data: preview,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/aggregate-reports/definitions/:id/run
 */
export async function executeRunHandler(req, res, next) {
  try {
    const { id } = req.params;
    const run = await aggregateService.executeReportRun(id, req.body, req.user, req);
    res.status(201).json({
      success: true,
      data: run,
      message: `Report run ${run.definitionName} v${run.version} generated successfully.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/aggregate-reports/runs
 */
export async function getRunsHandler(req, res, next) {
  try {
    const { definitionId, status, page, limit } = req.query;
    const result = await aggregateService.getReportRuns({ definitionId, status, page, limit });
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/aggregate-reports/runs/:id
 */
export async function getRunByIdHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { ReportRun } = await import('../models/ReportRun.js');
    const run = await ReportRun.findById(id).populate('runBy', 'name email').lean();
    if (!run) {
      return res.status(404).json({ success: false, error: 'Report run not found' });
    }
    res.json({
      success: true,
      data: run,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/aggregate-reports/runs/:id/submit-approval
 */
export async function submitForApprovalHandler(req, res, next) {
  try {
    const { id } = req.params;
    const run = await aggregateService.submitReportRunForApproval(id, req.body, req.user, req);
    res.json({
      success: true,
      data: run,
      message: `Report run submitted for senior review.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/aggregate-reports/runs/:id/approve
 */
export async function approveRunHandler(req, res, next) {
  try {
    const { id } = req.params;
    const run = await aggregateService.approveReportRun(id, req.body, req.user, req);
    res.json({
      success: true,
      data: run,
      message: `Report run approved.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/aggregate-reports/runs/:id/export/csv
 */
export async function exportCsvHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { ReportRun } = await import('../models/ReportRun.js');
    const run = await ReportRun.findById(id).lean();
    if (!run) {
      return res.status(404).json({ success: false, error: 'Report run not found' });
    }

    const csvContent = aggregateService.generateCsvExport(run);
    const fileName = run.fileReference?.csvFileName || `aggregate_report_v${run.version}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/aggregate-reports/runs/:id/export/pdf
 */
export async function exportPdfHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { ReportRun } = await import('../models/ReportRun.js');
    const run = await ReportRun.findById(id).lean();
    if (!run) {
      return res.status(404).json({ success: false, error: 'Report run not found' });
    }

    const pdfBuffer = await aggregateService.generatePdfExport(run);
    const fileName = run.fileReference?.pdfFileName || `aggregate_report_v${run.version}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

