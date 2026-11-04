import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { Case } from '../models/Case.js';
import { Intake } from '../models/Intake.js';
import { MedicalAssessment } from '../models/MedicalAssessment.js';
import { IcsrMessage } from '../models/IcsrMessage.js';
import { IcsrAcknowledgement } from '../models/IcsrAcknowledgement.js';
import { scoreCasePair } from './duplicate.service.js';
import { auditTrail } from '../utils/audit.js';

export const SYNTHETIC_E2B_NOTICE = 'Successful export ≠ regulatory compliance. Synthetic educational E2B(R3) schema.';

const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  trimValues: true,
  parseTagValue: true,
  isArray: (name) => ['product', 'reaction', 'error', 'item'].includes(name.toLowerCase()),
};

const xmlBuilderOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: false,
};

/**
 * Parses XML string into JS object
 * @param {string} xmlString
 * @returns {Object}
 */
export function parseIcsrXml(xmlString) {
  try {
    const parser = new XMLParser(xmlParserOptions);
    const parsed = parser.parse(xmlString);
    return parsed;
  } catch (err) {
    throw new Error(`XML parsing error: ${err.message}`);
  }
}

/**
 * Builds XML string from JS object
 * @param {Object} data
 * @returns {string}
 */
export function buildIcsrXml(data) {
  const builder = new XMLBuilder(xmlBuilderOptions);
  const xmlContent = builder.build(data);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${SYNTHETIC_E2B_NOTICE} -->\n${xmlContent}`;
}

/**
 * Validates ICSR payload against educational E2B rules.
 * Returns structured validation errors: [{ path, message }].
 *
 * @param {Object} icsrData
 * @returns {{ valid: boolean, errors: Array<{ path: string, message: string }> }}
 */
export function validateIcsr(icsrData) {
  const errors = [];

  if (!icsrData || typeof icsrData !== 'object') {
    return {
      valid: false,
      errors: [{ path: 'root', message: 'Payload must be a non-empty object or valid XML/JSON.' }],
    };
  }

  // Support both wrapped <ichicsr> root and direct object
  const root = icsrData.ichicsr || icsrData;
  const header = root.ichicsrmessageheader || root.header || {};
  const report = root.safetyreport || root.safetyReport || root.report || root;

  // 1. Message Header Validations
  if (!header.messagetype && !root.messagetype) {
    errors.push({ path: 'header.messagetype', message: 'Message type is required (expected "ichicsr").' });
  }
  if (!header.messagesenderidentifier && !root.messagesenderidentifier) {
    errors.push({ path: 'header.messagesenderidentifier', message: 'Message sender identifier is required.' });
  }
  if (!header.messagereceiveridentifier && !root.messagereceiveridentifier) {
    errors.push({ path: 'header.messagereceiveridentifier', message: 'Message receiver identifier is required.' });
  }
  if (!header.messagedate && !root.messagedate) {
    errors.push({ path: 'header.messagedate', message: 'Message date is required.' });
  }

  // 2. Minimum Criteria Check: Reporter
  const primarySource = report.primarysource || report.primarySource || {};
  const reporterName = primarySource.reportername || primarySource.reporterName || primarySource.name;
  const reporterCountry = primarySource.reportercountry || primarySource.reporterCountry || primarySource.country;
  if (!reporterName && !reporterCountry) {
    errors.push({
      path: 'safetyreport.primarysource',
      message: 'Minimum criterion 1/4 missing: An identifiable reporter name or country is required.',
    });
  }

  // 3. Minimum Criteria Check: Patient
  const patient = report.patient || {};
  const patientId = patient.patientinitial || patient.patientInitial || patient.reference || patient.id;
  const patientAge = patient.patientonsetage ?? patient.patientOnsetAge ?? patient.age;
  const patientSex = patient.patientsex ?? patient.patientSex ?? patient.sex;
  if (!patientId && patientAge === undefined && !patientSex) {
    errors.push({
      path: 'safetyreport.patient',
      message: 'Minimum criterion 2/4 missing: An identifiable patient initial, age, or sex is required.',
    });
  }

  // Check future date on patient birth / receipt date if given
  const receiptDateStr = report.receiptdate || report.receiptDate || header.messagedate;
  if (receiptDateStr) {
    const rDate = new Date(receiptDateStr);
    if (!isNaN(rDate.getTime()) && rDate.getTime() > Date.now() + 86400000) {
      errors.push({ path: 'safetyreport.receiptdate', message: 'Receipt date cannot be in the future.' });
    }
  }

  // 4. Minimum Criteria Check: Suspect Medicinal Product
  let products = report.products?.product || report.products || report.product || [];
  if (!Array.isArray(products)) {
    products = products ? [products] : [];
  }
  if (products.length === 0) {
    errors.push({
      path: 'safetyreport.products',
      message: 'Minimum criterion 3/4 missing: At least one medicinal product must be reported.',
    });
  } else {
    const hasSuspect = products.some((p) => {
      const drugRole = String(p.drugcharacterization || p.drugRole || p.role || '1').toLowerCase();
      return (
        drugRole === '1' ||
        drugRole === 'suspect' ||
        drugRole === 'suspected' ||
        p.medicinalproduct ||
        p.productName
      );
    });

    if (!hasSuspect) {
      errors.push({
        path: 'safetyreport.products',
        message: 'At least one product must be designated with suspect characterization.',
      });
    }

    products.forEach((p, idx) => {
      if (!p.medicinalproduct && !p.productName) {
        errors.push({
          path: `safetyreport.products[${idx}].medicinalproduct`,
          message: 'Product name (medicinalproduct) is required.',
        });
      }
    });
  }

  // 5. Minimum Criteria Check: Adverse Event / Reaction
  let reactions = report.reactions?.reaction || report.reactions || report.reaction || [];
  if (!Array.isArray(reactions)) {
    reactions = reactions ? [reactions] : [];
  }
  if (reactions.length === 0) {
    errors.push({
      path: 'safetyreport.reactions',
      message: 'Minimum criterion 4/4 missing: At least one adverse reaction or event must be reported.',
    });
  } else {
    reactions.forEach((r, idx) => {
      if (!r.reactionmeddrapt && !r.reactionverbatim && !r.verbatim && !r.pt) {
        errors.push({
          path: `safetyreport.reactions[${idx}]`,
          message: 'Reaction must specify at least a verbatim reaction description or MedDRA PT.',
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Maps a Case document (and optional MedicalAssessment) into a synthetic E2B ICSR format.
 *
 * @param {Object} caseDoc Case document
 * @param {Object} [assessmentDoc] Optional MedicalAssessment document
 * @param {'JSON'|'XML'} [format='JSON'] Desired output format
 * @returns {{ payload: string, format: string, data: Object, validation: { valid: boolean, errors: Array } }}
 */
export function caseToIcsr(caseDoc, assessmentDoc = null, format = 'JSON') {
  if (!caseDoc) {
    throw new Error('Case document is required for ICSR export');
  }

  const isXml = String(format).toUpperCase() === 'XML';
  const now = new Date();
  const dateFormatted = now.toISOString().slice(0, 10).replace(/-/g, '');
  const transmissionId = `ICH-${caseDoc.caseNumber || 'CASE'}-${Date.now()}`;

  // Products mapping
  const mappedProducts = (caseDoc.caseProducts || []).map((p) => {
    let drugChar = 1; // 1 = Suspect
    if (p.role === 'Concomitant') drugChar = 2;
    if (p.role === 'Interacting') drugChar = 3;

    return {
      drugcharacterization: drugChar,
      medicinalproduct: p.productName,
      drugdosagetext: p.dose ? `${p.dose} ${p.frequency || ''}`.trim() : '',
      drugadministrationroute: p.route || '',
      drugindication: p.indication || '',
      drugstartdate: p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : '',
      drugenddate: p.stopDate ? new Date(p.stopDate).toISOString().slice(0, 10) : '',
      lotnumber: p.lotNumber || '',
    };
  });

  // If no caseProducts but legacy product string exists
  if (mappedProducts.length === 0 && caseDoc.product) {
    mappedProducts.push({
      drugcharacterization: 1,
      medicinalproduct: caseDoc.product,
      drugdosagetext: '',
      drugadministrationroute: '',
      drugindication: '',
      drugstartdate: '',
      drugenddate: '',
      lotnumber: '',
    });
  }

  // Reactions mapping
  const mappedReactions = (caseDoc.reactions || []).map((r) => {
    let outcomeCode = 0; // Unknown
    if (r.outcome === 'recovered') outcomeCode = 1;
    if (r.outcome === 'recovering') outcomeCode = 2;
    if (r.outcome === 'not_recovered') outcomeCode = 3;
    if (r.outcome === 'fatal') outcomeCode = 4;

    return {
      reactionverbatim: r.verbatim || '',
      reactionmeddrapt: r.pt || '',
      reactionmeddrasoc: r.soc || '',
      reactionmeddralltcode: r.meddraCode || '',
      reactionstartdate: r.startDate ? new Date(r.startDate).toISOString().slice(0, 10) : '',
      reactionoutcome: outcomeCode,
      reactioncausality: r.causality || 'Not Assessed',
    };
  });

  // Patient sex mapping: 1=Male, 2=Female, 0=Unknown
  let sexCode = 0;
  if (caseDoc.patient?.sex === 'Male') sexCode = 1;
  if (caseDoc.patient?.sex === 'Female') sexCode = 2;

  // Seriousness criteria mapping
  const seriousnessCriteria = assessmentDoc?.seriousnessCriteria || [];
  const isSerious = caseDoc.serious || seriousnessCriteria.length > 0;

  const e2bData = {
    ichicsr: {
      '@_lang': 'en',
      ichicsrmessageheader: {
        messagetype: 'ichicsr',
        messageformatversion: '2.1-SYNTHETIC',
        messagereleaseversion: '2.0',
        messagesenderidentifier: 'SPONSOR-SAFETY',
        messagereceiveridentifier: 'HEALTH-AUTHORITY-GATEWAY',
        messagedateformat: '204',
        messagedate: dateFormatted,
        syntheticNotice: SYNTHETIC_E2B_NOTICE,
      },
      safetyreport: {
        safetyreportversion: '1',
        safetyreportid: caseDoc.caseNumber,
        primarysourcecountry: caseDoc.country || caseDoc.reporter?.country || 'India',
        occurcountry: caseDoc.country || 'India',
        transmissiondate: dateFormatted,
        receiptdate: caseDoc.receiptDate
          ? new Date(caseDoc.receiptDate).toISOString().slice(0, 10)
          : dateFormatted,
        serious: isSerious ? 1 : 2,
        seriousnesscriteria: {
          death: seriousnessCriteria.includes('death') ? 1 : 2,
          lifethreatening: seriousnessCriteria.includes('life_threatening') ? 1 : 2,
          hospitalization: seriousnessCriteria.includes('hospitalization') ? 1 : 2,
          disabling: seriousnessCriteria.includes('disability') ? 1 : 2,
          congenitalanomaly: seriousnessCriteria.includes('congenital_anomaly') ? 1 : 2,
          medicallyimportant: seriousnessCriteria.includes('medically_important') ? 1 : 2,
        },
        primarysource: {
          reportername: caseDoc.reporter?.name || 'Healthcare Professional',
          qualification: caseDoc.reporter?.qualification || 'Physician',
          reportercountry: caseDoc.reporter?.country || caseDoc.country || 'India',
          reporterorganization: caseDoc.reporter?.organization || '',
          contact: caseDoc.reporter?.contact || '',
        },
        patient: {
          patientinitial: caseDoc.patient?.reference || 'ANON',
          patientonsetage: caseDoc.patient?.age ?? '',
          patientonsetageunit: caseDoc.patient?.ageUnit || 'years',
          patientsex: sexCode,
          patientweight: caseDoc.patient?.weight ?? '',
        },
        products: {
          product: mappedProducts,
        },
        reactions: {
          reaction: mappedReactions,
        },
        summary: {
          narrativeincludeclinical: caseDoc.narrative || caseDoc.eventSummary || '',
          reportercomment: caseDoc.reporterComment || '',
          sendercomment: assessmentDoc?.medicalComment || '',
        },
        educationalDisclaimer: {
          message: SYNTHETIC_E2B_NOTICE,
          mode: 'EDUCATIONAL_SIMULATION',
          transmissionId,
        },
      },
    },
  };

  const validation = validateIcsr(e2bData);

  const payloadString = isXml
    ? buildIcsrXml(e2bData)
    : JSON.stringify(e2bData, null, 2);

  return {
    payload: payloadString,
    format: isXml ? 'XML' : 'JSON',
    data: e2bData,
    validation,
    transmissionId,
  };
}

/**
 * Converts synthetic ICSR data into intake-compatible fields.
 *
 * @param {Object} parsedData
 * @returns {Object} Mapped intake structure
 */
export function icsrToCase(parsedData) {
  const root = parsedData.ichicsr || parsedData;
  const report = root.safetyreport || root.safetyReport || root.report || root;
  const primarySource = report.primarysource || report.primarySource || {};
  const patient = report.patient || {};

  let products = report.products?.product || report.products || report.product || [];
  if (!Array.isArray(products)) products = products ? [products] : [];

  let reactions = report.reactions?.reaction || report.reactions || report.reaction || [];
  if (!Array.isArray(reactions)) reactions = reactions ? [reactions] : [];

  // Find primary suspect product
  const suspectProduct =
    products.find((p) => String(p.drugcharacterization) === '1' || String(p.role).toLowerCase() === 'suspect') ||
    products[0] ||
    {};

  const primaryReaction = reactions[0] || {};

  let sex = 'Unknown';
  if (String(patient.patientsex) === '1' || String(patient.sex).toLowerCase() === 'male') sex = 'Male';
  if (String(patient.patientsex) === '2' || String(patient.sex).toLowerCase() === 'female') sex = 'Female';

  return {
    source: 'regulator',
    receiptDate: report.receiptdate ? new Date(report.receiptdate) : new Date(),
    reporter: {
      name: primarySource.reportername || primarySource.reporterName || primarySource.name || 'Anonymous ICSR Reporter',
      qualification: primarySource.qualification || 'Physician',
      contact: primarySource.contact || '',
      country: primarySource.reportercountry || primarySource.reporterCountry || report.primarysourcecountry || 'India',
    },
    patient: {
      reference: patient.patientinitial || patient.patientInitial || 'UNKNOWN',
      age: patient.patientonsetage ? Number(patient.patientonsetage) : null,
      ageUnit: patient.patientonsetageunit || 'years',
      sex,
      weight: patient.patientweight ? Number(patient.patientweight) : null,
    },
    suspectedProduct: suspectProduct.medicinalproduct || suspectProduct.productName || 'Unknown Product',
    reportedReaction:
      primaryReaction.reactionmeddrapt ||
      primaryReaction.reactionverbatim ||
      primaryReaction.verbatim ||
      primaryReaction.pt ||
      'Unspecified Adverse Reaction',
    narrative:
      report.summary?.narrativeincludeclinical ||
      report.narrative ||
      report.eventSummary ||
      `ICSR transmission from ${primarySource.reportername || 'Regulatory Gateway'}. Suspected: ${suspectProduct.medicinalproduct || 'Product'}, Event: ${primaryReaction.reactionmeddrapt || primaryReaction.reactionverbatim || 'Reaction'}.`,
    products: products.map((p) => ({
      productName: p.medicinalproduct || p.productName || 'Unknown',
      role: String(p.drugcharacterization) === '2' ? 'Concomitant' : String(p.drugcharacterization) === '3' ? 'Interacting' : 'Suspect',
      dose: p.drugdosagetext || '',
      route: p.drugadministrationroute || '',
      indication: p.drugindication || '',
    })),
    reactions: reactions.map((r) => ({
      verbatim: r.reactionverbatim || r.reactionmeddrapt || r.verbatim || 'Reaction',
      pt: r.reactionmeddrapt || r.pt || '',
      soc: r.reactionmeddrasoc || r.soc || '',
      meddraCode: r.reactionmeddralltcode || '',
    })),
  };
}

/**
 * Runs duplicate screening on parsed ICSR data against existing Cases.
 *
 * @param {Object} mappedData
 * @returns {Promise<{ hasDuplicateWarning: boolean, highestScore: number, matchedCaseNumber: string|null, matches: Array }>}
 */
export async function screenIcsrDuplicates(mappedData) {
  try {
    const candidateCases = await Case.find({}).lean().limit(100);

    const transientCase = {
      product: mappedData.suspectedProduct,
      caseProducts: [{ productName: mappedData.suspectedProduct, role: 'Suspect' }],
      reactions: mappedData.reactions?.length
        ? mappedData.reactions
        : [{ verbatim: mappedData.reportedReaction, pt: mappedData.reportedReaction }],
      eventSummary: mappedData.narrative,
      patient: mappedData.patient,
      reporter: mappedData.reporter,
      receiptDate: mappedData.receiptDate,
    };

    let highestScore = 0;
    let bestMatch = null;
    const matches = [];

    for (const c of candidateCases) {
      const result = scoreCasePair(transientCase, c);
      if (result.score >= 50) {
        matches.push({
          caseId: c._id,
          caseNumber: c.caseNumber,
          score: result.score,
          matchedFields: result.matchedFields,
          breakdown: result.breakdown,
        });
      }
      if (result.score > highestScore) {
        highestScore = result.score;
        bestMatch = c;
      }
    }

    matches.sort((a, b) => b.score - a.score);

    return {
      hasDuplicateWarning: highestScore >= 60,
      highestScore,
      matchedCaseNumber: bestMatch ? bestMatch.caseNumber : null,
      matches: matches.slice(0, 5),
    };
  } catch (err) {
    return {
      hasDuplicateWarning: false,
      highestScore: 0,
      matchedCaseNumber: null,
      matches: [],
    };
  }
}

/**
 * Exports a Case as synthetic ICSR E2B message and saves in IcsrMessage collection.
 */
export async function exportCaseIcsr(caseId, format = 'JSON', user = null, req = null) {
  const caseDoc = await Case.findById(caseId);
  if (!caseDoc) {
    throw new Error('Case not found');
  }

  const assessmentDoc = await MedicalAssessment.findOne({ caseId }).sort({ version: -1 });

  const { payload, data, validation, transmissionId } = caseToIcsr(caseDoc, assessmentDoc, format);

  const messageId = `MSG-OUT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const message = await IcsrMessage.create({
    messageId,
    direction: 'OUT',
    format: format.toUpperCase(),
    status: validation.valid ? 'VALIDATED' : 'FAILED',
    payload,
    parsedData: data,
    validationErrors: validation.errors,
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    senderIdentifier: data.ichicsr?.ichicsrmessageheader?.messagesenderidentifier || 'SPONSOR-SAFETY',
    receiverIdentifier: data.ichicsr?.ichicsrmessageheader?.messagereceiveridentifier || 'HEALTH-AUTHORITY-GATEWAY',
    createdBy: user?._id || null,
  });

  if (auditTrail) {
    await auditTrail({
      action: 'EXPORT',
      entity: 'IcsrMessage',
      entityId: message._id,
      user,
      req,
      details: {
        caseNumber: caseDoc.caseNumber,
        format,
        isValid: validation.valid,
        transmissionId,
        errorCount: validation.errors.length,
      },
    });
  }

  return {
    message,
    payload,
    format: format.toUpperCase(),
    validation,
  };
}

/**
 * Previews an inbound ICSR XML or JSON payload: parses, validates, maps, and runs duplicate checks without saving.
 */
export async function previewIcsrImport(rawPayload, format = 'AUTO') {
  if (!rawPayload || !rawPayload.trim()) {
    throw new Error('Payload is empty');
  }

  const trimmed = rawPayload.trim();
  let detectedFormat = format;
  if (detectedFormat === 'AUTO') {
    detectedFormat = trimmed.startsWith('<') ? 'XML' : 'JSON';
  }

  let parsedObj;
  if (detectedFormat.toUpperCase() === 'XML') {
    parsedObj = parseIcsrXml(trimmed);
  } else {
    try {
      parsedObj = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(`JSON parsing error: ${err.message}`);
    }
  }

  const validation = validateIcsr(parsedObj);
  const mappedData = icsrToCase(parsedObj);
  const duplicateScreening = await screenIcsrDuplicates(mappedData);

  return {
    format: detectedFormat.toUpperCase(),
    validation,
    mappedData,
    duplicateScreening,
    syntheticDisclaimer: SYNTHETIC_E2B_NOTICE,
  };
}

/**
 * Confirms ICSR import: creates Intake record and saves IcsrMessage.
 */
export async function confirmIcsrImport(rawPayload, format = 'AUTO', user = null, req = null) {
  const preview = await previewIcsrImport(rawPayload, format);

  if (!preview.validation.valid) {
    const err = new Error('Cannot import invalid ICSR. Please resolve validation errors.');
    err.validationErrors = preview.validation.errors;
    err.statusCode = 422;
    throw err;
  }

  // Generate unique intake number
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = await Intake.countDocuments();
  const intakeNumber = `INT-${today}-${String(count + 1).padStart(4, '0')}`;

  const intake = await Intake.create({
    intakeNumber,
    source: preview.mappedData.source || 'regulator',
    receiptDate: preview.mappedData.receiptDate || new Date(),
    reporter: preview.mappedData.reporter,
    patient: preview.mappedData.patient,
    suspectedProduct: preview.mappedData.suspectedProduct,
    reportedReaction: preview.mappedData.reportedReaction,
    narrative: preview.mappedData.narrative,
    status: 'RECEIVED',
    validation: {
      hasMinimumCriteria: true,
      missingFields: [],
      criteriaStatus: {
        identifiableReporter: true,
        identifiablePatient: true,
        suspectProduct: true,
        reportedEvent: true,
      },
      duplicateCandidates: preview.duplicateScreening.matches.map((m) => ({
        caseId: m.caseId,
        caseNumber: m.caseNumber,
        similarityScore: m.score,
      })),
    },
  });

  const messageId = `MSG-IN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const message = await IcsrMessage.create({
    messageId,
    direction: 'IN',
    format: preview.format,
    status: 'PROCESSED',
    payload: rawPayload,
    parsedData: preview.mappedData,
    validationErrors: [],
    intakeId: intake._id,
    intakeNumber: intake.intakeNumber,
    duplicateScreening: {
      hasDuplicateWarning: preview.duplicateScreening.hasDuplicateWarning,
      highestScore: preview.duplicateScreening.highestScore,
      matchedCaseNumber: preview.duplicateScreening.matchedCaseNumber,
      matchedFields: preview.duplicateScreening.matches[0]?.matchedFields || [],
    },
    senderIdentifier: 'HEALTH-AUTHORITY-GATEWAY',
    receiverIdentifier: 'SPONSOR-SAFETY',
    createdBy: user?._id || null,
  });

  if (auditTrail) {
    await auditTrail({
      action: 'IMPORT',
      entity: 'IcsrMessage',
      entityId: message._id,
      user,
      req,
      details: {
        intakeNumber: intake.intakeNumber,
        format: preview.format,
        hasDuplicateWarning: preview.duplicateScreening.hasDuplicateWarning,
      },
    });
  }

  return {
    success: true,
    intake,
    message,
    duplicateScreening: preview.duplicateScreening,
  };
}

/**
 * Simulates a health authority gateway E2B acknowledgement (ACK).
 */
export async function mockGatewayAcknowledge(messageIdOrDoc, ackCode = 'ACK_OK', note = '', user = null, req = null) {
  let message = typeof messageIdOrDoc === 'string'
    ? await IcsrMessage.findById(messageIdOrDoc)
    : messageIdOrDoc;

  if (!message) {
    throw new Error('ICSR message not found');
  }

  const ackId = `ACK-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  const ackPayload = {
    ichicsrack: {
      ichicsrmessageheader: {
        messagetype: 'ichicsrack',
        messageformatversion: '2.1-SYNTHETIC',
        messagesenderidentifier: message.receiverIdentifier || 'HEALTH-AUTHORITY-GATEWAY',
        messagereceiveridentifier: message.senderIdentifier || 'SPONSOR-SAFETY',
        messagedate: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      },
      acknowledgment: {
        originalmessageid: message.messageId,
        originalmessagetype: 'ichicsr',
        reportacknowledgment: {
          safetyreportid: message.caseNumber || 'REPORT',
          localreportnumber: `ACK-REF-${message.messageId}`,
          reportacknowledgmentcode: ackCode === 'ACK_OK' ? '01' : '02',
          acknowledgmenttext:
            ackCode === 'ACK_OK'
              ? 'Report successfully accepted into authority safety repository (Synthetic Gateway Simulation).'
              : 'Report rejected due to synthetic schema discrepancies.',
        },
      },
      syntheticNotice: SYNTHETIC_E2B_NOTICE,
    },
  };

  const ack = await IcsrAcknowledgement.create({
    ackId,
    messageId: message._id,
    transmissionId: message.messageId,
    ackCode,
    ackPayload,
    note: note || (ackCode === 'ACK_OK' ? 'Synthetic transmission accepted by Gateway' : 'Gateway rejected message'),
    createdBy: user?._id || null,
  });

  message.status = 'ACKNOWLEDGED';
  message.ackRef = ack.ackId;
  await message.save();

  if (auditTrail) {
    await auditTrail({
      action: 'UPDATE',
      entity: 'IcsrMessage',
      entityId: message._id,
      user,
      req,
      details: {
        ackId: ack.ackId,
        ackCode,
        messageId: message.messageId,
      },
    });
  }

  return {
    ack,
    message,
  };
}

