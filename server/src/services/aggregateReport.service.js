import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import { ReportDefinition } from '../models/ReportDefinition.js';
import { ReportRun } from '../models/ReportRun.js';
import { Case } from '../models/Case.js';
import { recordAudit } from '../utils/audit.js';

export class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

export const SYNTHETIC_REPORT_DEFINITIONS_SEED = [
  {
    name: 'Periodic Safety Update Report (EU / ICH E2C R2)',
    description:
      'Synthetic PSUR evaluating cumulative post-marketing benefit-risk data, signal detection findings, and population exposure.',
    reportType: 'PSUR',
    period: {
      periodType: 'QUARTERLY',
      relativeDays: 90,
    },
    filters: {
      seriousness: 'ALL',
      products: [],
      countries: [],
    },
    grouping: ['product', 'preferredTerm', 'seriousness', 'country'],
    format: ['CSV', 'PDF'],
    version: 1,
  },
  {
    name: 'Periodic Benefit-Risk Evaluation Report (PBRER)',
    description:
      'Comprehensive ICH PBRER integrating clinical trial and post-authorization safety data with benefit-risk conclusions.',
    reportType: 'PBRER',
    period: {
      periodType: 'ANNUAL',
      relativeDays: 365,
    },
    filters: {
      seriousness: 'ALL',
      products: [],
      countries: [],
    },
    grouping: ['product', 'preferredTerm', 'seriousness', 'country'],
    format: ['CSV', 'PDF'],
    version: 1,
  },
  {
    name: 'Development Safety Update Report (DSUR)',
    description:
      'Annual aggregate clinical trial safety evaluation covering investigational medicinal products (ICH E2F guidelines).',
    reportType: 'DSUR',
    period: {
      periodType: 'ANNUAL',
      relativeDays: 365,
    },
    filters: {
      seriousness: 'Serious',
      products: [],
      countries: [],
    },
    grouping: ['product', 'preferredTerm', 'seriousness', 'country'],
    format: ['CSV', 'PDF'],
    version: 1,
  },
  {
    name: 'Cumulative Suspected Adverse Reaction Line Listing',
    description:
      'Detailed case-by-case line listing containing patient demographics, exposure windows, MedDRA PTs, and causality assessments.',
    reportType: 'LINE_LISTING',
    period: {
      periodType: 'LAST_30_DAYS',
      relativeDays: 30,
    },
    filters: {
      seriousness: 'ALL',
      products: [],
      countries: [],
    },
    grouping: ['product', 'country'],
    format: ['CSV', 'PDF'],
    version: 1,
  },
  {
    name: 'Adverse Drug Reaction Summary Tabulation (Product × PT)',
    description:
      'Tabulation matrix grouping reported reactions by MedDRA System Organ Class (SOC) and Preferred Term (PT) against suspect drugs.',
    reportType: 'SUMMARY_TABULATION',
    period: {
      periodType: 'QUARTERLY',
      relativeDays: 90,
    },
    filters: {
      seriousness: 'ALL',
      products: [],
      countries: [],
    },
    grouping: ['product', 'preferredTerm', 'seriousness'],
    format: ['CSV', 'PDF'],
    version: 1,
  },
];

/**
 * Seed initial standard synthetic report definitions if none exist.
 */
export async function seedDefaultReportDefinitions() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const count = await ReportDefinition.countDocuments();
    if (count === 0) {
      await ReportDefinition.insertMany(SYNTHETIC_REPORT_DEFINITIONS_SEED);
    }
  } catch {
    // Ignore in transient / test contexts
  }
}

/**
 * Calculates start and end dates based on period definition.
 */
export function calculatePeriodDates(period = {}) {
  const now = new Date();
  const periodType = period.periodType || 'QUARTERLY';

  if (periodType === 'CUSTOM' && period.startDate && period.endDate) {
    return {
      startDate: new Date(period.startDate),
      endDate: new Date(period.endDate),
    };
  }

  let days = period.relativeDays || 90;
  if (periodType === 'LAST_30_DAYS') days = 30;
  if (periodType === 'MONTHLY') days = 30;
  if (periodType === 'QUARTERLY') days = 90;
  if (periodType === 'SEMI_ANNUAL') days = 180;
  if (periodType === 'ANNUAL') days = 365;

  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const endDate = now;

  return { startDate, endDate };
}

/**
 * Retrieves all report definitions.
 */
export async function getReportDefinitions({ active = true } = {}) {
  await seedDefaultReportDefinitions();
  const query = active ? { active: true } : {};
  return ReportDefinition.find(query).sort({ createdAt: -1 }).lean();
}

/**
 * Creates a new aggregate report definition.
 */
export async function createReportDefinition(data, user, req) {
  if (!data.name || !data.reportType) {
    throw new ValidationError('Report name and reportType are required.');
  }

  const periodDates = calculatePeriodDates(data.period);

  const definition = await ReportDefinition.create({
    name: data.name,
    description: data.description || '',
    reportType: data.reportType,
    period: {
      ...data.period,
      startDate: periodDates.startDate,
      endDate: periodDates.endDate,
    },
    filters: data.filters || {},
    grouping: data.grouping || ['product', 'preferredTerm', 'seriousness', 'country'],
    schedule: data.schedule || { isScheduled: false, frequency: 'NONE' },
    format: data.format || ['CSV', 'PDF'],
    version: 1,
    active: true,
    createdBy: user?._id || null,
    createdByName: user?.name || 'Safety Specialist',
  });

  await recordAudit({
    actor: user,
    action: 'AGGREGATE_REPORT_DEFINITION_CREATED',
    entity: 'ReportDefinition',
    entityId: String(definition._id),
    summary: `Aggregate report definition created: ${definition.name} (${definition.reportType}).`,
    details: { name: definition.name, reportType: definition.reportType },
    req,
  });

  return definition;
}

/**
 * Generates aggregate summary tabulation and line listings from case data.
 */
export async function generateAggregateData(filters = {}, period = {}) {
  const { startDate, endDate } = calculatePeriodDates(period);

  const query = {
    receiptDate: { $gte: startDate, $lte: endDate },
  };

  if (filters.seriousness && filters.seriousness !== 'ALL') {
    query.seriousness = filters.seriousness;
  }
  if (filters.countries && filters.countries.length > 0) {
    query.country = { $in: filters.countries };
  }

  const cases = await Case.find(query)
    .sort({ receiptDate: 1 })
    .lean();

  const lineListing = [];
  const tabulationMap = new Map();

  for (const c of cases) {
    // Determine suspect products
    const products =
      c.caseProducts && c.caseProducts.length > 0
        ? c.caseProducts
        : [{ productName: 'Unspecified Medicinal Product', role: 'Suspect' }];

    // Filter by products if specified
    const matchingProducts =
      filters.products && filters.products.length > 0
        ? products.filter((p) =>
            filters.products.some(
              (filterProd) =>
                p.productName.toLowerCase().includes(filterProd.toLowerCase()) ||
                (p.genericName && p.genericName.toLowerCase().includes(filterProd.toLowerCase())),
            ),
          )
        : products;

    if (matchingProducts.length === 0) continue;

    // Reactions
    const reactions =
      c.reactions && c.reactions.length > 0
        ? c.reactions
        : [{ verbatim: 'Adverse Event Not Specified', pt: 'Adverse event', soc: 'General disorders', outcome: 'unknown' }];

    const seriousnessCriteria = [];
    if (c.seriousnessFlags?.death) seriousnessCriteria.push('Death');
    if (c.seriousnessFlags?.lifeThreatening) seriousnessCriteria.push('Life Threatening');
    if (c.seriousnessFlags?.hospitalization) seriousnessCriteria.push('Hospitalization');
    if (c.seriousnessFlags?.disability) seriousnessCriteria.push('Disability');
    if (c.seriousnessFlags?.congenitalAnomaly) seriousnessCriteria.push('Congenital Anomaly');
    if (c.seriousnessFlags?.otherMedicallyImportant) seriousnessCriteria.push('Medically Important');

    const patientAgeStr = c.patient?.age
      ? `${c.patient.age} ${c.patient.ageUnit || 'yrs'}`
      : 'Unknown';

    for (const prod of matchingProducts) {
      for (const rxn of reactions) {
        const preferredTerm = rxn.pt || rxn.verbatim || 'Adverse Event';
        const soc = rxn.soc || 'General disorders and administration site conditions';
        const country = c.country || 'Global';
        const prodName = prod.productName;
        const isSerious = c.seriousness === 'Serious';
        const isFatal = rxn.outcome === 'fatal' || c.seriousnessFlags?.death === true;

        // Add to Line Listing
        lineListing.push({
          caseId: c._id,
          caseNumber: c.caseNumber,
          receiptDate: c.receiptDate,
          country,
          patientAge: patientAgeStr,
          patientSex: c.patient?.sex || 'Unknown',
          productName: prodName,
          productRole: prod.role || 'Suspect',
          preferredTerm,
          verbatimReaction: rxn.verbatim || preferredTerm,
          seriousness: c.seriousness || 'Non-Serious',
          seriousnessCriteria,
          causality: rxn.causality || c.assessment?.companyCausality || 'Unassessed',
          outcome: rxn.outcome || 'unknown',
        });

        // Add to Summary Tabulation
        const tabKey = `${prodName}|${preferredTerm}|${soc}|${country}`;
        if (!tabulationMap.has(tabKey)) {
          tabulationMap.set(tabKey, {
            product: prodName,
            preferredTerm,
            systemOrganClass: soc,
            country,
            seriousCount: 0,
            nonSeriousCount: 0,
            fatalCount: 0,
            totalCount: 0,
          });
        }

        const tabEntry = tabulationMap.get(tabKey);
        tabEntry.totalCount += 1;
        if (isSerious) tabEntry.seriousCount += 1;
        else tabEntry.nonSeriousCount += 1;
        if (isFatal) tabEntry.fatalCount += 1;
      }
    }
  }

  const summaryTabulation = Array.from(tabulationMap.values()).sort(
    (a, b) => b.totalCount - a.totalCount || a.product.localeCompare(b.product),
  );

  return {
    period: { startDate, endDate },
    totalCases: cases.length,
    totalReactions: lineListing.length,
    summaryTabulation,
    lineListing,
  };
}

/**
 * Previews an aggregate report on the fly without persisting a ReportRun document.
 */
export async function previewAggregateReport({ definitionId, filters = {}, period = {} }) {
  let activeFilters = filters;
  let activePeriod = period;

  if (definitionId) {
    const def = await ReportDefinition.findById(definitionId).lean();
    if (def) {
      activeFilters = { ...def.filters, ...filters };
      activePeriod = { ...def.period, ...period };
    }
  }

  return generateAggregateData(activeFilters, activePeriod);
}

/**
 * Executes a persistent report run with version incrementing, tabulation, and line listing.
 */
export async function executeReportRun(definitionId, { filtersOverride, periodOverride } = {}, user, req) {
  const definition = await ReportDefinition.findById(definitionId);
  if (!definition) {
    throw new NotFoundError(`ReportDefinition not found with ID ${definitionId}`);
  }

  const filters = { ...definition.filters, ...(filtersOverride || {}) };
  const period = { ...definition.period, ...(periodOverride || {}) };

  // Calculate version number: next version for this definition
  const lastRun = await ReportRun.findOne({ definitionId }).sort({ version: -1 }).lean();
  const nextVersion = (lastRun?.version || 0) + 1;

  // Execute aggregation
  const aggResult = await generateAggregateData(filters, period);

  const csvFileName = `${definition.reportType}_${definition.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${nextVersion}.csv`;
  const pdfFileName = `${definition.reportType}_${definition.name.replace(/[^a-zA-Z0-9]/g, '_')}_v${nextVersion}.pdf`;

  const reportRun = await ReportRun.create({
    definitionId: definition._id,
    definitionName: definition.name,
    reportType: definition.reportType,
    version: nextVersion,
    period: aggResult.period,
    filtersApplied: filters,
    status: 'GENERATED',
    summaryTabulation: aggResult.summaryTabulation,
    lineListing: aggResult.lineListing,
    totalCases: aggResult.totalCases,
    totalReactions: aggResult.totalReactions,
    fileReference: {
      csvFileName,
      pdfFileName,
    },
    runBy: user?._id || null,
    runByName: user?.name || 'Safety Specialist',
    runAt: new Date(),
    approval: {
      status: 'DRAFT',
    },
    history: [
      {
        fromStatus: 'QUEUED',
        toStatus: 'GENERATED',
        by: user?._id || null,
        byName: user?.name || 'Safety Specialist',
        at: new Date(),
        note: `Initial aggregate generation v${nextVersion}. Evaluated ${aggResult.totalCases} cases and ${aggResult.totalReactions} adverse reactions.`,
      },
    ],
  });

  await recordAudit({
    actor: user,
    action: 'AGGREGATE_REPORT_RUN_GENERATED',
    entity: 'ReportRun',
    entityId: String(reportRun._id),
    summary: `Aggregate safety report run generated: ${definition.name} v${nextVersion} (${aggResult.totalCases} cases).`,
    details: {
      definitionId: String(definition._id),
      version: nextVersion,
      totalCases: aggResult.totalCases,
      totalReactions: aggResult.totalReactions,
    },
    req,
  });

  return reportRun;
}

/**
 * Retrieves all runs for a given definition or system-wide.
 */
export async function getReportRuns({ definitionId, status, page = 1, limit = 50 } = {}) {
  const query = {};
  if (definitionId) query.definitionId = definitionId;
  if (status) query.status = status;

  const total = await ReportRun.countDocuments(query);
  const runs = await ReportRun.find(query)
    .sort({ runAt: -1, version: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('runBy', 'name email')
    .populate('approval.approvedBy', 'name email')
    .lean();

  return {
    runs,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Submits a generated report run for senior regulatory / QPPV approval.
 */
export async function submitReportRunForApproval(runId, { comments = '' } = {}, user, req) {
  const run = await ReportRun.findById(runId);
  if (!run) {
    throw new NotFoundError(`ReportRun not found with ID ${runId}`);
  }

  const fromStatus = run.status;
  run.status = 'PENDING_APPROVAL';
  run.approval = {
    status: 'PENDING_APPROVAL',
    requestedBy: user?._id || null,
    requestedByName: user?.name || 'Safety Specialist',
    requestedAt: new Date(),
    comments: comments || 'Submitted for QPPV / QA periodic review.',
  };

  run.history.push({
    fromStatus,
    toStatus: 'PENDING_APPROVAL',
    by: user?._id || null,
    byName: user?.name || 'Safety Specialist',
    at: new Date(),
    note: comments || 'Submitted for senior regulatory approval.',
  });

  await run.save();

  await recordAudit({
    actor: user,
    action: 'AGGREGATE_REPORT_SUBMITTED_FOR_APPROVAL',
    entity: 'ReportRun',
    entityId: String(run._id),
    summary: `Aggregate report run ${run.definitionName} v${run.version} submitted for approval.`,
    details: { comments },
    req,
  });

  return run;
}

/**
 * Approves a report run.
 */
export async function approveReportRun(runId, { comments = '' } = {}, user, req) {
  const run = await ReportRun.findById(runId);
  if (!run) {
    throw new NotFoundError(`ReportRun not found with ID ${runId}`);
  }

  const fromStatus = run.status;
  run.status = 'APPROVED';
  run.approval = {
    status: 'APPROVED',
    requestedBy: run.approval?.requestedBy || null,
    requestedByName: run.approval?.requestedByName || '',
    requestedAt: run.approval?.requestedAt || null,
    approvedBy: user?._id || null,
    approvedByName: user?.name || 'Qualified Person / Director',
    approvedAt: new Date(),
    comments: comments || 'Approved by QPPV / Qualified Person.',
  };

  run.history.push({
    fromStatus,
    toStatus: 'APPROVED',
    by: user?._id || null,
    byName: user?.name || 'Qualified Person / Director',
    at: new Date(),
    note: comments || 'Approved by regulatory authority delegate.',
  });

  await run.save();

  await recordAudit({
    actor: user,
    action: 'AGGREGATE_REPORT_APPROVED',
    entity: 'ReportRun',
    entityId: String(run._id),
    summary: `Aggregate report run ${run.definitionName} v${run.version} approved by ${user?.name}.`,
    details: { comments },
    req,
  });

  return run;
}

/**
 * Generates RFC-compliant CSV string containing both Summary Tabulation and Line Listings.
 */
export function generateCsvExport(run) {
  const lines = [];

  // Header metadata
  lines.push(`"Report Title","${run.definitionName.replace(/"/g, '""')}"`);
  lines.push(`"Report Type","${run.reportType}"`);
  lines.push(`"Version","v${run.version}"`);
  lines.push(`"Interval","${new Date(run.period.startDate).toISOString().split('T')[0]} to ${new Date(run.period.endDate).toISOString().split('T')[0]}"`);
  lines.push(`"Generated At","${new Date(run.runAt).toISOString()}"`);
  lines.push(`"Total Cases Analyzed","${run.totalCases}"`);
  lines.push(`"Regulatory Notice","Aggregate safety reporting evaluates cumulative population benefit-risk profiles over defined statutory intervals and is fundamentally distinct from expedited individual case safety reports (ICSRs)."`);
  lines.push('');

  // SECTION 1: Summary Tabulation
  lines.push('--- SUMMARY TABULATION (PRODUCT x PREFERRED TERM x SOC x COUNTRY) ---');
  lines.push('"Product Name","MedDRA Preferred Term (PT)","System Organ Class (SOC)","Country","Serious Count","Non-Serious Count","Fatal Count","Total Count"');

  for (const item of run.summaryTabulation || []) {
    lines.push(
      `"${item.product.replace(/"/g, '""')}","${item.preferredTerm.replace(/"/g, '""')}","${item.systemOrganClass.replace(/"/g, '""')}","${item.country}","${item.seriousCount}","${item.nonSeriousCount}","${item.fatalCount}","${item.totalCount}"`,
    );
  }

  lines.push('');

  // SECTION 2: Detailed Line Listing
  lines.push('--- CUMULATIVE ADVERSE REACTION LINE LISTING ---');
  lines.push('"Case Number","Receipt Date","Country","Patient Age","Patient Sex","Product Name","Role","Preferred Term (PT)","Verbatim Reaction","Seriousness","Criteria","Causality","Outcome"');

  for (const item of run.lineListing || []) {
    const receiptDateStr = new Date(item.receiptDate).toISOString().split('T')[0];
    const criteriaStr = (item.seriousnessCriteria || []).join('; ');
    lines.push(
      `"${item.caseNumber}","${receiptDateStr}","${item.country}","${item.patientAge}","${item.patientSex}","${item.productName.replace(/"/g, '""')}","${item.productRole}","${item.preferredTerm.replace(/"/g, '""')}","${item.verbatimReaction.replace(/"/g, '""')}","${item.seriousness}","${criteriaStr}","${item.causality}","${item.outcome}"`,
    );
  }

  return lines.join('\r\n');
}

/**
 * Generates professional PDF safety dossier buffer using PDFKit.
 */
export async function generatePdfExport(run) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      // Title & Header
      doc.fontSize(18).fillColor('#1e1b4b').text('AGGREGATE SAFETY DOSSIER', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(13).fillColor('#312e81').text(run.definitionName, { align: 'center' });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#4338ca').text(
        `Report Type: ${run.reportType}   |   Version: v${run.version}   |   Status: ${run.status}`,
        { align: 'center' },
      );
      doc.moveDown(0.8);

      // Statutory Distinction Banner
      doc.rect(36, doc.y, 523, 44).fillAndStroke('#eff6ff', '#bfdbfe');
      const bannerY = doc.y + 6;
      doc.fillColor('#1e3a8a').fontSize(8.5).font('Helvetica-Bold')
        .text('STATUTORY REGULATORY DISTINCTION:', 44, bannerY);
      doc.font('Helvetica').fontSize(7.5).fillColor('#1e40af')
        .text(
          'Aggregate safety reporting (PSUR/PBRER/DSUR) evaluates cumulative population benefit-risk profiles over defined intervals. It is fundamentally distinct from expedited individual case safety reports (ICSRs), which enforce strict statutory deadlines for single case alerts.',
          44,
          bannerY + 12,
          { width: 507 },
        );

      doc.y = bannerY + 46;
      doc.moveDown(0.5);

      // Metadata Summary Box
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827').text('Reporting Interval & Scope:');
      doc.font('Helvetica').fontSize(8.5).fillColor('#374151');
      doc.text(`Interval: ${new Date(run.period.startDate).toDateString()} - ${new Date(run.period.endDate).toDateString()}`);
      doc.text(`Generated At: ${new Date(run.runAt).toLocaleString()} by ${run.runByName}`);
      doc.text(`Cumulative Cases Evaluated: ${run.totalCases}   |   Total Adverse Events: ${run.totalReactions}`);
      if (run.approval?.approvedByName) {
        doc.text(`Approved By: ${run.approval.approvedByName} on ${new Date(run.approval.approvedAt).toLocaleDateString()}`);
      }
      doc.moveDown(0.8);

      // SECTION 1: Summary Tabulation Table
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('1. Summary Tabulation (Product x PT x Country)');
      doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#6b7280')
        .text('Aggregate reaction counts grouped by suspect product and MedDRA Preferred Term.');
      doc.moveDown(0.4);

      // Tabulation Header
      const tabColX = [36, 150, 270, 370, 420, 470, 510];
      doc.rect(36, doc.y, 523, 16).fill('#f1f5f9');
      const tableHeadY = doc.y + 4;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155');
      doc.text('Product Name', tabColX[0] + 4, tableHeadY);
      doc.text('Preferred Term (PT)', tabColX[1], tableHeadY);
      doc.text('System Organ Class (SOC)', tabColX[2], tableHeadY);
      doc.text('Country', tabColX[3], tableHeadY);
      doc.text('Serious', tabColX[4], tableHeadY);
      doc.text('Fatal', tabColX[5], tableHeadY);
      doc.text('Total', tabColX[6], tableHeadY);

      doc.y = tableHeadY + 16;
      doc.font('Helvetica').fontSize(7).fillColor('#1f2937');

      const tabulationSlice = (run.summaryTabulation || []).slice(0, 30);
      for (const item of tabulationSlice) {
        if (doc.y > 750) {
          doc.addPage();
        }
        const rowY = doc.y;
        doc.text(item.product.substring(0, 22), tabColX[0] + 4, rowY);
        doc.text(item.preferredTerm.substring(0, 24), tabColX[1], rowY);
        doc.text(item.systemOrganClass.substring(0, 20), tabColX[2], rowY);
        doc.text(item.country.substring(0, 10), tabColX[3], rowY);
        doc.text(String(item.seriousCount), tabColX[4], rowY);
        doc.text(String(item.fatalCount), tabColX[5], rowY);
        doc.text(String(item.totalCount), tabColX[6], rowY);
        doc.moveDown(0.4);
      }

      if ((run.summaryTabulation || []).length > 30) {
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#6b7280')
          .text(`... and ${(run.summaryTabulation.length - 30)} additional tabulation rows (see CSV for complete enumeration).`);
      }

      doc.moveDown(1);

      // SECTION 2: Line Listing Preview
      if (doc.y > 680) doc.addPage();
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('2. Case Line Listing (Sample)');
      doc.fontSize(7.5).font('Helvetica-Oblique').fillColor('#6b7280')
        .text('Detailed case listing showing patient profile, exposure window, and clinical causality.');
      doc.moveDown(0.4);

      const lineColX = [36, 110, 165, 235, 315, 395, 455, 510];
      doc.rect(36, doc.y, 523, 16).fill('#f1f5f9');
      const lineHeadY = doc.y + 4;
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#334155');
      doc.text('Case #', lineColX[0] + 4, lineHeadY);
      doc.text('Date', lineColX[1], lineHeadY);
      doc.text('Country', lineColX[2], lineHeadY);
      doc.text('Product', lineColX[3], lineHeadY);
      doc.text('Reaction PT', lineColX[4], lineHeadY);
      doc.text('Seriousness', lineColX[5], lineHeadY);
      doc.text('Causality', lineColX[6], lineHeadY);
      doc.text('Outcome', lineColX[7], lineHeadY);

      doc.y = lineHeadY + 16;
      doc.font('Helvetica').fontSize(7).fillColor('#1f2937');

      const listingSlice = (run.lineListing || []).slice(0, 25);
      for (const item of listingSlice) {
        if (doc.y > 750) {
          doc.addPage();
        }
        const rowY = doc.y;
        const dateStr = new Date(item.receiptDate).toISOString().split('T')[0];
        doc.text(item.caseNumber, lineColX[0] + 4, rowY);
        doc.text(dateStr, lineColX[1], rowY);
        doc.text(item.country.substring(0, 12), lineColX[2], rowY);
        doc.text(item.productName.substring(0, 14), lineColX[3], rowY);
        doc.text(item.preferredTerm.substring(0, 15), lineColX[4], rowY);
        doc.text(item.seriousness, lineColX[5], rowY);
        doc.text(item.causality.substring(0, 10), lineColX[6], rowY);
        doc.text(item.outcome.substring(0, 10), lineColX[7], rowY);
        doc.moveDown(0.4);
      }

      if ((run.lineListing || []).length > 25) {
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#6b7280')
          .text(`... and ${(run.lineListing.length - 25)} additional line listing rows.`);
      }

      // Final Footer
      doc.fontSize(7).fillColor('#9ca3af')
        .text('Confidential Pharmacovigilance Regulatory Document — Generated by Drug Safety CMS', 36, 790, {
          align: 'center',
          width: 523,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

