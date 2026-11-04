/**
 * WhatsApp Pharmacovigilance Message Formatter
 * Generates executive-ready, cleanly structured WhatsApp messages using native markdown:
 * - Bold headings (*text*)
 * - WhatsApp blockquotes (> text) for clean card visuals
 * - Structured bullets and clean spacing
 * - Prevents awkward mobile word-wrapping and removes messy box-drawing lines
 */

/**
 * Formats a directory list of safety cases for WhatsApp sharing.
 */
export function formatCasesListWhatsApp({ cases = [], totalCases = 0, activeQuickFilter = 'All' }) {
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const seriousCount = cases.filter((c) => c.seriousness === 'Serious').length;
  const nonSeriousCount = cases.filter((c) => c.seriousness !== 'Serious').length;

  const caseCards = cases.slice(0, 6).map((c, i) => {
    const prod = c.product || c.caseProducts?.[0]?.productName || 'Unspecified Drug';
    const event = c.eventSummary || c.reactions?.[0]?.verbatim || 'No reaction documented';
    const isSerious = c.seriousness === 'Serious';
    const serBadge = isSerious ? '🔴 *SERIOUS*' : '🟢 *Non-Serious*';
    const priority = (c.priority || 'medium').toUpperCase();

    const patientInfo = [
      c.patient?.age != null ? `${c.patient.age}y` : (c.patientAge ? `${c.patientAge}y` : null),
      c.patient?.sex || c.patientGender || null,
    ].filter(Boolean).join(', ') || 'Demographics unrecorded';

    const dateStr = c.receiptDate ? new Date(c.receiptDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

    return [
      `*${i + 1}. CASE ${c.caseNumber}* • ${prod}`,
      `> ${serBadge} | Priority: ${priority}`,
      `> ⚡ *Event:* ${event}`,
      `> 👤 *Pt:* ${patientInfo} | 📅 ${dateStr}`,
    ].join('\n');
  }).join('\n\n');

  const remainingCount = (totalCases || cases.length) - Math.min(cases.length, 6);

  const lines = [
    `🏥 *DRUG SAFETY CMS — PV DISPATCH* 🏥`,
    `_Executive Pharmacovigilance Summary_`,
    ``,
    `📊 *REGISTRY SNAPSHOT*`,
    `• *Generated:* ${timestamp}`,
    `• *Active Filter:* ${activeQuickFilter}`,
    `• *Total in View:* ${totalCases || cases.length} cases`,
    `• *Severity Ratio:* 🔴 ${seriousCount} Serious | 🟢 ${nonSeriousCount} Non-Serious`,
    ``,
    `📋 *KEY SAFETY CASES*`,
    caseCards || '> _No matching cases found for selected criteria._',
    ``,
    ...(remainingCount > 0 ? [`_📁 +${remainingCount} more safety cases tracked in live registry._`, ``] : []),
    `🔗 *Platform Directory:* ${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/cases`,
    `🔐 _Notice: Regulated pharmacovigilance data. Strict confidentiality applies under 21 CFR Part 11 / GVP guidelines._`,
  ];

  return lines.join('\n');
}

/**
 * Formats a single safety case report for WhatsApp sharing.
 */
export function formatCaseDetailsWhatsApp(c) {
  if (!c) return '';

  const prod = c.product || c.caseProducts?.[0]?.productName || 'Unspecified Product';
  const dosage = c.caseProducts?.[0]?.dose ? ` (${c.caseProducts[0].dose})` : '';
  const event = c.eventSummary || c.reactions?.[0]?.verbatim || 'No event summary';
  const ptTerm = c.reactions?.[0]?.pt ? ` [MedDRA PT: ${c.reactions[0].pt}]` : '';

  const isSerious = c.seriousness === 'Serious';
  const serIcon = isSerious ? '🔴 *SERIOUS REPORT*' : '🟢 *Non-Serious Report*';
  const priority = (c.priority || 'medium').toUpperCase();
  const status = (c.status || 'new').replace(/_/g, ' ').toUpperCase();

  const patientAge = c.patient?.age != null ? `${c.patient.age} yrs` : (c.patientAge ? `${c.patientAge} yrs` : 'Unknown');
  const patientSex = c.patient?.sex || c.patientGender || 'Unknown';
  const patientRef = c.patient?.reference || 'N/A';

  const repName = c.reporter?.name || 'Healthcare Professional';
  const repRole = c.reporter?.qualification || 'Physician';
  const repCountry = c.reporter?.country || c.country || 'India';

  const receiptDate = c.receiptDate ? new Date(c.receiptDate).toLocaleDateString('en-US', { dateStyle: 'medium' }) : 'N/A';
  const dueDate = c.regulatoryDueDate ? new Date(c.regulatoryDueDate).toLocaleDateString('en-US', { dateStyle: 'medium' }) : null;

  const lines = [
    `🚨 *SAFETY CASE REPORT: ${c.caseNumber}* 🚨`,
    `_Clinical Pharmacovigilance Notification_`,
    ``,
    `📌 *CASE ESSENTIALS*`,
    `> 💊 *Suspected Product:* ${prod}${dosage}`,
    `> ⚡ *Reported Reaction:* ${event}${ptTerm}`,
    `> ${serIcon}`,
    `> 🔥 *Priority:* ${priority}  |  🏷️ *Status:* ${status}`,
    ``,
    `👤 *PATIENT & CLINICAL DEMOGRAPHICS*`,
    `> • *Age & Sex:* ${patientAge}, ${patientSex}`,
    `> • *Reference ID:* ${patientRef}`,
    `> • *Reporter:* ${repName} (${repRole}, ${repCountry})`,
    `> • *Receipt Date:* ${receiptDate}`,
    ...(dueDate ? [`> • ⏰ *Regulatory Due Date:* ${dueDate}`] : []),
    ``,
    ...(c.narrative ? [
      `📝 *CLINICAL NARRATIVE*`,
      `> "${c.narrative.length > 200 ? c.narrative.slice(0, 200) + '…' : c.narrative}"`,
      ``,
    ] : []),
    `🔗 *Open Case Workspace:*`,
    `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/cases/${c.caseNumber}`,
    ``,
    `🔐 _Confidential & Legally Privileged Pharmacovigilance Documentation._`,
  ];

  return lines.join('\n');
}

/**
 * Formats an Adverse Event Intake record for WhatsApp sharing.
 */
export function formatIntakeWhatsApp(intake) {
  if (!intake) return '';

  const prod = intake.suspectedProduct || 'N/A';
  const reaction = intake.reportedReaction || 'N/A';
  const status = (intake.status || 'RECEIVED').toUpperCase();
  const criteriaMet = intake.validation?.hasMinimumCriteria ? '✅ VALID (4/4 Met)' : '⚠️ INCOMPLETE';

  const ptInfo = [
    intake.patient?.age != null ? `${intake.patient.age}y` : null,
    intake.patient?.sex || null,
  ].filter(Boolean).join(', ') || 'Demographics unrecorded';

  const repInfo = `${intake.reporter?.name || 'Anonymous'} (${intake.reporter?.qualification || 'Physician'})`;
  const receiptDate = intake.receiptDate ? new Date(intake.receiptDate).toLocaleDateString('en-US', { dateStyle: 'medium' }) : 'N/A';

  const lines = [
    `📋 *ADVERSE EVENT INTAKE: ${intake.intakeNumber}* 📋`,
    `_Initial Pharmacovigilance Triage Notification_`,
    ``,
    `📌 *INTAKE SUMMARY*`,
    `> 💊 *Suspected Drug:* ${prod}`,
    `> ⚡ *Reported Reaction:* ${reaction}`,
    `> 🏷️ *Status:* ${status}  |  Criteria: ${criteriaMet}`,
    ``,
    `👤 *SOURCE DEMOGRAPHICS*`,
    `> • *Patient:* ${ptInfo} (Ref: ${intake.patient?.reference || 'N/A'})`,
    `> • *Reporter:* ${repInfo}`,
    `> • *Receipt Date:* ${receiptDate}`,
    `> • *Source Channel:* ${(intake.source || 'physician').toUpperCase()}`,
    ``,
    ...(intake.narrative ? [
      `📝 *INTAKE NARRATIVE*`,
      `> "${intake.narrative.length > 180 ? intake.narrative.slice(0, 180) + '…' : intake.narrative}"`,
      ``,
    ] : []),
    `🔗 *Review Intake:*`,
    `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/intakes/${intake._id}`,
    ``,
    `🔐 _Confidential — Healthcare Safety Triage Record._`,
  ];

  return lines.join('\n');
}

/**
 * Formats a Duplicate Assessment Pair for WhatsApp sharing.
 */
export function formatDuplicateReviewWhatsApp(review) {
  if (!review) return '';

  const sNum = review.sourceCaseNumber || review.sourceId?.caseNumber || 'CASE-????';
  const cNum = review.candidateCaseNumber || review.candidateCaseId?.caseNumber || 'CASE-????';
  const score = review.score || 0;
  const decision = (review.decision || 'PENDING').replace(/_/g, ' ');

  const source = review.sourceId || {};
  const cand = review.candidateCaseId || {};

  const lines = [
    `🔍 *PV DUPLICATE ASSESSMENT: ${sNum} vs ${cNum}* 🔍`,
    `_Algorithmic Similarity & Compliance Review_`,
    ``,
    `🎯 *MATCH CONFIDENCE: ${score}%*`,
    `> • *Decision Status:* ${decision}`,
    `> • *Matched Fields:* ${review.matchedFields?.join(', ') || 'None'}`,
    ``,
    `⚖️ *CASE PAIR COMPARISON*`,
    `> *1. Source (${sNum}):*`,
    `>    • Drug: ${source.product || 'N/A'}`,
    `>    • Event: ${source.eventSummary || 'N/A'}`,
    `>    • Patient: ${source.patient?.age || source.patientAge || '?'}y, ${source.patient?.sex || source.patientGender || '?'}`,
    `>`,
    `> *2. Candidate (${cNum}):*`,
    `>    • Drug: ${cand.product || 'N/A'}`,
    `>    • Event: ${cand.eventSummary || 'N/A'}`,
    `>    • Patient: ${cand.patient?.age || cand.patientAge || '?'}y, ${cand.patient?.sex || cand.patientGender || '?'}`,
    ``,
    ...(review.reason ? [
      `📝 *REVIEWER RATIONALE:*`,
      `> "${review.reason}"`,
      ``,
    ] : []),
    `🔗 *Compare Side-by-Side:*`,
    `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}/duplicates/${review._id}`,
    ``,
    `🔐 _Regulated Pharmacovigilance Governance Log._`,
  ];

  return lines.join('\n');
}

/**
 * Helper to open WhatsApp share dialog
 */
export function openWhatsAppShare(text) {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export { default as WhatsAppIcon } from '../components/common/WhatsAppIcon';

