import mongoose from 'mongoose';
import { Term } from '../models/Term.js';
import { CodingRecord } from '../models/CodingRecord.js';
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

/**
 * Searches medical terminology with autocomplete, text, and regex matching.
 */
export async function searchTerms({ q = '', level = null, limit = 20 }) {
  const query = {};
  const maxLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  if (level) {
    if (Array.isArray(level)) {
      query.level = { $in: level };
    } else {
      query.level = level;
    }
  }

  const trimmed = q.trim();
  if (trimmed) {
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    query.$or = [
      { name: regex },
      { code: regex },
      { 'hierarchy.name': regex },
    ];
  }

  const terms = await Term.find(query)
    .sort({
      // Prefer PT and LLT for adverse reactions, then SOC
      level: 1,
      name: 1,
    })
    .limit(maxLimit)
    .lean();

  return terms.map((t) => ({
    ...t,
    breadcrumb: (t.hierarchy || []).map((h) => `${h.level}: ${h.name}`).join(' > ') || t.name,
  }));
}

/**
 * Generates top 5 auto-suggested terms for a verbatim reaction string.
 */
export async function suggestTermsForVerbatim(verbatim = '', limit = 5) {
  if (!verbatim || !verbatim.trim()) {
    return [];
  }

  const cleanVerbatim = verbatim.trim().toLowerCase();
  // Strip common filler words
  const words = cleanVerbatim
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['and', 'the', 'with', 'for', 'after', 'taking', 'patient', 'mild', 'severe'].includes(w));

  // Try exact or word matches on PT and LLT first
  const regexConditions = [];
  regexConditions.push({ name: new RegExp(`^${cleanVerbatim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') });

  for (const word of words) {
    regexConditions.push({ name: new RegExp(word, 'i') });
  }

  const candidateTerms = await Term.find({
    level: { $in: ['PT', 'LLT'] },
    $or: regexConditions,
  })
    .limit(30)
    .lean();

  // Score candidate relevance
  const scored = candidateTerms.map((term) => {
    let score = 0;
    const termLower = term.name.toLowerCase();

    if (termLower === cleanVerbatim) {
      score += 100; // Exact match
    } else if (cleanVerbatim.includes(termLower)) {
      score += 60; // Verbatim contains term
    } else if (termLower.includes(cleanVerbatim)) {
      score += 50; // Term contains verbatim
    }

    // Word overlap bonus
    for (const w of words) {
      if (termLower.includes(w)) {
        score += 15;
      }
    }

    // Give a slight edge to PT over LLT if scores are otherwise equal
    if (term.level === 'PT') {
      score += 2;
    }

    return {
      term,
      score,
      confidence: score >= 60 ? 'High' : score >= 25 ? 'Medium' : 'Low',
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => ({
    ...s.term,
    confidence: s.confidence,
    matchScore: s.score,
    breadcrumb: (s.term.hierarchy || []).map((h) => `${h.level}: ${h.name}`).join(' > ') || s.term.name,
  }));
}

/**
 * Creates or initialises a coding record for a case reaction.
 */
export async function createCodingRecord({
  caseId,
  reactionId,
  codedTermId,
  dictionaryVersion = 'SYN-MedDRA-27.0',
  reason = 'Initial medical coding',
  user = null,
  req = null,
}) {
  if (!caseId || !reactionId || !codedTermId) {
    throw new ValidationError('caseId, reactionId, and codedTermId are all strictly required.');
  }

  const caseDoc = await Case.findById(caseId);
  if (!caseDoc) {
    throw new NotFoundError(`Safety case not found: ${caseId}`);
  }

  const reaction = caseDoc.reactions.id(reactionId);
  if (!reaction) {
    throw new NotFoundError(`Reaction subdocument not found in case: ${reactionId}`);
  }

  const targetTerm = await Term.findById(codedTermId).lean();
  if (!targetTerm) {
    throw new NotFoundError(`Target medical term not found: ${codedTermId}`);
  }

  // Determine PT and SOC from hierarchy
  let ptName = targetTerm.name;
  let socName = '';
  let meddraCode = targetTerm.code;

  if (targetTerm.hierarchy && targetTerm.hierarchy.length > 0) {
    const ptEntry = targetTerm.hierarchy.find((h) => h.level === 'PT');
    const socEntry = targetTerm.hierarchy.find((h) => h.level === 'SOC');
    if (ptEntry) ptName = ptEntry.name;
    if (socEntry) socName = socEntry.name;
  }

  let record = await CodingRecord.findOne({ caseId, reactionId });
  const isUpdate = !!record;

  if (record) {
    // Save history of the previous coding
    const oldTerm = await Term.findById(record.codedTermId).lean();
    record.history.push({
      codedTermId: record.codedTermId,
      codedTermSnapshot: oldTerm
        ? {
            code: oldTerm.code,
            name: oldTerm.name,
            level: oldTerm.level,
            hierarchy: oldTerm.hierarchy,
          }
        : {},
      codedBy: record.codedBy,
      codedByName: user?.name || 'System',
      codedAt: record.codedAt || new Date(),
      reason: reason || 'Coding update',
      dictionaryVersion: record.dictionaryVersion,
    });

    record.codedTermId = targetTerm._id;
    record.dictionaryVersion = dictionaryVersion || targetTerm.dictionaryVersion || 'SYN-MedDRA-27.0';
    record.codedBy = user?._id || null;
    record.codedAt = new Date();
    record.status = 'overridden';
    record.verbatimText = reaction.verbatim; // Always preserve verbatim
    await record.save();
  } else {
    record = await CodingRecord.create({
      caseId: caseDoc._id,
      reactionId: reaction._id,
      verbatimText: reaction.verbatim, // Always preserve verbatim
      codedTermId: targetTerm._id,
      dictionaryVersion: dictionaryVersion || targetTerm.dictionaryVersion || 'SYN-MedDRA-27.0',
      codedBy: user?._id || null,
      codedAt: new Date(),
      status: 'coded',
      history: [],
    });
  }

  // Synchronise case reactions subdocument with coded values
  reaction.pt = ptName;
  reaction.soc = socName;
  reaction.meddraCode = meddraCode;
  caseDoc.version = (caseDoc.version || 1) + 1;
  await caseDoc.save();

  // 21 CFR Part 11 compliant audit logging
  await recordAudit({
    actor: user,
    action: isUpdate ? 'CODING_RECORD_OVERRIDDEN' : 'CODING_RECORD_CREATED',
    entity: 'CodingRecord',
    entityId: String(record._id),
    summary: `${isUpdate ? 'Updated' : 'Assigned'} MedDRA coding for reaction "${reaction.verbatim}" to "${targetTerm.name}" (${targetTerm.code}, ${targetTerm.level}) in case ${caseDoc.caseNumber}. Reason: ${reason}`,
    details: {
      caseId: String(caseDoc._id),
      caseNumber: caseDoc.caseNumber,
      reactionId: String(reaction._id),
      verbatimText: reaction.verbatim,
      codedTermCode: targetTerm.code,
      codedTermName: targetTerm.name,
      codedTermLevel: targetTerm.level,
      pt: ptName,
      soc: socName,
      dictionaryVersion: record.dictionaryVersion,
      reason,
      isUpdate,
    },
    req,
  });

  return {
    codingRecord: await CodingRecord.findById(record._id).populate('codedTermId').lean(),
    case: caseDoc,
  };
}

/**
 * Modifies an existing coding record, requiring an audit reason.
 */
export async function updateCodingRecord(
  id,
  { codedTermId, reason, dictionaryVersion = 'SYN-MedDRA-27.0' },
  user = null,
  req = null,
) {
  if (!reason || !reason.trim()) {
    throw new ValidationError('A non-empty reason is strictly required under 21 CFR Part 11 when changing medical coding.');
  }

  const record = await CodingRecord.findById(id);
  if (!record) {
    throw new NotFoundError(`Coding record not found: ${id}`);
  }

  const newTerm = await Term.findById(codedTermId).lean();
  if (!newTerm) {
    throw new NotFoundError(`Target medical term not found: ${codedTermId}`);
  }

  const oldTerm = await Term.findById(record.codedTermId).lean();

  // Push current state to history
  record.history.push({
    codedTermId: record.codedTermId,
    codedTermSnapshot: oldTerm
      ? {
          code: oldTerm.code,
          name: oldTerm.name,
          level: oldTerm.level,
          hierarchy: oldTerm.hierarchy,
        }
      : {},
    codedBy: record.codedBy,
    codedByName: user?.name || 'System',
    codedAt: record.codedAt || new Date(),
    reason: reason.trim(),
    dictionaryVersion: record.dictionaryVersion,
  });

  record.codedTermId = newTerm._id;
  record.dictionaryVersion = dictionaryVersion || newTerm.dictionaryVersion || 'SYN-MedDRA-27.0';
  record.codedBy = user?._id || null;
  record.codedAt = new Date();
  record.status = 'overridden';
  await record.save();

  // Synchronise case reactions
  const caseDoc = await Case.findById(record.caseId);
  if (caseDoc) {
    const reaction = caseDoc.reactions.id(record.reactionId);
    if (reaction) {
      let ptName = newTerm.name;
      let socName = '';
      if (newTerm.hierarchy && newTerm.hierarchy.length > 0) {
        const ptEntry = newTerm.hierarchy.find((h) => h.level === 'PT');
        const socEntry = newTerm.hierarchy.find((h) => h.level === 'SOC');
        if (ptEntry) ptName = ptEntry.name;
        if (socEntry) socName = socEntry.name;
      }
      reaction.pt = ptName;
      reaction.soc = socName;
      reaction.meddraCode = newTerm.code;
      caseDoc.version = (caseDoc.version || 1) + 1;
      await caseDoc.save();
    }
  }

  // Record 21 CFR Part 11 Audit
  await recordAudit({
    actor: user,
    action: 'CODING_RECORD_OVERRIDDEN',
    entity: 'CodingRecord',
    entityId: String(record._id),
    summary: `Re-coded reaction "${record.verbatimText}" from "${oldTerm?.name || 'Unknown'}" to "${newTerm.name}" (${newTerm.code}) in case ${caseDoc?.caseNumber || record.caseId}. Reason: ${reason}`,
    details: {
      codingRecordId: String(record._id),
      caseId: String(record.caseId),
      oldTerm: oldTerm ? { code: oldTerm.code, name: oldTerm.name, level: oldTerm.level } : null,
      newTerm: { code: newTerm.code, name: newTerm.name, level: newTerm.level },
      reason: reason.trim(),
      dictionaryVersion: record.dictionaryVersion,
    },
    req,
  });

  return CodingRecord.findById(record._id)
    .populate('codedTermId')
    .populate('history.codedTermId')
    .lean();
}

/**
 * Retrieves coding status and details for all reactions in a case.
 */
export async function getCaseCoding(caseIdOrNumber) {
  let caseDoc = null;
  if (mongoose.Types.ObjectId.isValid(caseIdOrNumber)) {
    caseDoc = await Case.findOne({
      $or: [{ _id: caseIdOrNumber }, { caseNumber: caseIdOrNumber.toUpperCase() }],
    });
  } else {
    caseDoc = await Case.findOne({ caseNumber: caseIdOrNumber.toUpperCase() });
  }

  if (!caseDoc) {
    throw new NotFoundError(`Case not found: ${caseIdOrNumber}`);
  }

  const reactions = caseDoc.reactions || [];
  const codingRecords = await CodingRecord.find({ caseId: caseDoc._id })
    .populate('codedTermId')
    .populate('history.codedTermId')
    .populate('codedBy', 'name email role')
    .lean();

  const recordMap = new Map();
  for (const rec of codingRecords) {
    recordMap.set(String(rec.reactionId), rec);
  }

  const items = [];
  let codedCount = 0;

  for (const r of reactions) {
    const rec = recordMap.get(String(r._id)) || null;
    const isCoded = !!(rec && rec.codedTermId) || !!(r.pt && r.meddraCode);

    if (isCoded) {
      codedCount++;
    }

    // Auto-suggest top 5 matches based on verbatim text
    const suggestions = await suggestTermsForVerbatim(r.verbatim, 5);

    items.push({
      reactionId: r._id,
      verbatimText: r.verbatim,
      startDate: r.startDate,
      outcome: r.outcome,
      causality: r.causality,
      pt: r.pt,
      soc: r.soc,
      meddraCode: r.meddraCode,
      isCoded,
      codingRecord: rec,
      autoSuggestions: suggestions,
    });
  }

  const reactionsCount = reactions.length;
  const uncodedCount = Math.max(0, reactionsCount - codedCount);
  const isAllCoded = reactionsCount === 0 || uncodedCount === 0;

  return {
    caseId: caseDoc._id,
    caseNumber: caseDoc.caseNumber,
    caseStatus: caseDoc.status,
    reactionsCount,
    codedCount,
    uncodedCount,
    isAllCoded,
    items,
  };
}

