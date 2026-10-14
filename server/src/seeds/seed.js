import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { Case } from '../models/Case.js';
import { ActionItem } from '../models/ActionItem.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { Intake } from '../models/Intake.js';

export const SEEDED_ROLES = [
  {
    name: 'admin',
    displayName: 'System Administrator',
    description: 'Full administrative access to manage users, security, roles, and configuration.',
    permissions: ['*'],
    isSystem: true,
  },
  {
    name: 'case_manager',
    displayName: 'Case Manager',
    description: 'Manages incoming cases, assigns reviewers, oversees workflow timelines and action items.',
    permissions: [
      'case.create',
      'case.read',
      'case.update',
      'case.assign',
      'contact_log.create',
      'contact_log.read',
      'action_item.create',
      'action_item.read',
      'action_item.update',
      'reports.read',
    ],
    isSystem: true,
  },
  {
    name: 'reviewer',
    displayName: 'Safety Reviewer',
    description: 'Investigates and reviews assigned adverse event cases and assesses causality.',
    permissions: [
      'case.read',
      'case.update',
      'contact_log.create',
      'contact_log.read',
      'action_item.read',
      'action_item.update',
    ],
    isSystem: true,
  },
  {
    name: 'data_entry',
    displayName: 'Data Entry Specialist',
    description: 'Performs initial case intake, records adverse reactions and contact logs.',
    permissions: [
      'case.create',
      'case.read',
      'contact_log.create',
      'contact_log.read',
    ],
    isSystem: true,
  },
  {
    name: 'qa_specialist',
    displayName: 'Quality Assurance Auditor',
    description: 'Conducts compliance audits, reviews case logs, and verifies regulatory adherence.',
    permissions: [
      'case.read',
      'audit.read',
      'contact_log.read',
      'action_item.read',
      'reports.read',
    ],
    isSystem: true,
  },
  {
    name: 'regulatory_affairs',
    displayName: 'Regulatory Affairs Associate',
    description: 'Prepares and submits compliance documentation and generates periodic safety reports.',
    permissions: [
      'case.read',
      'reports.read',
      'contact_log.read',
    ],
    isSystem: true,
  },
  {
    name: 'viewer',
    displayName: 'Auditor / Viewer (Read-only)',
    description: 'Read-only access to view published case records.',
    permissions: [
      'case.read',
    ],
    isSystem: true,
  },
];

export async function seedDatabase() {
  logger.info('Seeding database with roles and default accounts…');

  // Seed or update roles
  const roleMap = new Map();
  for (const roleDef of SEEDED_ROLES) {
    const role = await Role.findOneAndUpdate(
      { name: roleDef.name },
      { $set: roleDef },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    roleMap.set(role.name, role._id);
  }

  logger.info(`✓ Seeded ${SEEDED_ROLES.length} roles`);

  // Default accounts for each of the 7 roles
  const demoUsers = [
    {
      name: 'System Admin',
      email: 'admin@drugsafety.local',
      password: 'Admin@123456',
      role: 'admin',
      status: 'active',
      mustChangePassword: false,
    },
    {
      name: 'Dr. Claire Manager',
      email: 'manager@drugsafety.local',
      password: 'Manager@123456',
      role: 'case_manager',
      status: 'active',
      mustChangePassword: false,
    },
    {
      name: 'Dr. Robert Reviewer',
      email: 'reviewer@drugsafety.local',
      password: 'Reviewer@123456',
      role: 'reviewer',
      status: 'active',
      mustChangePassword: false,
    },
    {
      name: 'David DataEntry',
      email: 'dataentry@drugsafety.local',
      password: 'DataEntry@123456',
      role: 'data_entry',
      status: 'active',
      mustChangePassword: false,
    },
    {
      name: 'Quinn QA Auditor',
      email: 'qa@drugsafety.local',
      password: 'QaSpec@123456',
      role: 'qa_specialist',
      status: 'active',
      mustChangePassword: false,
    },
    {
      name: 'Rachel Regulatory',
      email: 'regulatory@drugsafety.local',
      password: 'RegAffairs@123456',
      role: 'regulatory_affairs',
      status: 'active',
      mustChangePassword: false,
    },
    {
      name: 'Victor Viewer',
      email: 'viewer@drugsafety.local',
      password: 'Viewer@123456',
      role: 'viewer',
      status: 'active',
      mustChangePassword: false,
    },
    {
      name: 'Ian Inactive',
      email: 'inactive@drugsafety.local',
      password: 'Inactive@123456',
      role: 'viewer',
      status: 'inactive',
      mustChangePassword: false,
    },
    {
      name: 'Larry Locked',
      email: 'locked@drugsafety.local',
      password: 'Locked@123456',
      role: 'reviewer',
      status: 'active',
      failedAttempts: 5,
      lockUntil: new Date(Date.now() + 60 * 60 * 1000), // locked for 1 hour
      mustChangePassword: false,
    },
  ];

  for (const userDef of demoUsers) {
    const roleId = roleMap.get(userDef.role);
    const existing = await User.findOne({ email: userDef.email });

    const passwordHash = await bcrypt.hash(userDef.password, 12);

    if (!existing) {
      await User.create({
        name: userDef.name,
        email: userDef.email,
        passwordHash,
        roleId,
        status: userDef.status,
        failedAttempts: userDef.failedAttempts || 0,
        lockUntil: userDef.lockUntil || null,
        mustChangePassword: userDef.mustChangePassword,
        passwordHistory: [{ hash: passwordHash, changedAt: new Date() }],
      });
    } else {
      // Ensure roleId, status and test locks are aligned
      existing.roleId = roleId;
      existing.status = userDef.status;
      if (userDef.lockUntil) {
        existing.lockUntil = userDef.lockUntil;
        existing.failedAttempts = userDef.failedAttempts;
      }
      await existing.save();
    }
  }

  logger.info(`✓ Seeded ${demoUsers.length} demo users`);

  // ── Seed Cases & Action Items ─────────────────────────────
  await seedCasesAndWorkload();
}

async function seedCasesAndWorkload() {
  logger.info('Seeding cases, action items, and audit activity…');

  const adminUser = await User.findOne({ email: 'admin@drugsafety.local' });
  const managerUser = await User.findOne({ email: 'manager@drugsafety.local' });
  const reviewerUser = await User.findOne({ email: 'reviewer@drugsafety.local' });
  const dataEntryUser = await User.findOne({ email: 'dataentry@drugsafety.local' });

  // Idempotent seeding without clearing
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const demoCases = [
    {
      caseNumber: 'CASE-1001',
      reportType: 'Spontaneous',
      product: 'Medicine A',
      eventSummary: 'Skin Rash with generalised urticaria following 3rd dosage',
      seriousness: 'Non-Serious',
      status: 'new',
      assignedTo: managerUser?._id,
      regulatoryDueDate: new Date(now + 12 * dayMs),
      receivedDate: new Date(now - 1 * dayMs),
      patientAge: 38,
      patientGender: 'Female',
    },
    {
      caseNumber: 'CASE-1002',
      reportType: 'Clinical Trial',
      product: 'CardioGuard',
      eventSummary: 'Transient Tachycardia and syncopal episode requiring hospitalization',
      seriousness: 'Serious',
      status: 'medical_review',
      assignedTo: reviewerUser?._id,
      regulatoryDueDate: new Date(now + 2 * dayMs), // Due in 2 days (urgent reporting)
      receivedDate: new Date(now - 4 * dayMs),
      patientAge: 54,
      patientGender: 'Male',
    },
    {
      caseNumber: 'CASE-1003',
      reportType: 'Spontaneous',
      product: 'NeuroCalm',
      eventSummary: 'Persistent Dizziness and mild postural vertigo',
      seriousness: 'Non-Serious',
      status: 'medical_review',
      assignedTo: reviewerUser?._id,
      regulatoryDueDate: new Date(now + 5 * dayMs),
      receivedDate: new Date(now - 5 * dayMs),
      patientAge: 29,
      patientGender: 'Female',
    },
    {
      caseNumber: 'CASE-1004',
      reportType: 'Spontaneous',
      product: 'Medicine A',
      eventSummary: 'Marked Elevation of hepatic transaminases (ALT/AST > 3x ULN)',
      seriousness: 'Serious',
      status: 'quality_review',
      assignedTo: managerUser?._id,
      regulatoryDueDate: new Date(now + 3 * dayMs),
      receivedDate: new Date(now - 8 * dayMs),
      patientAge: 45,
      patientGender: 'Male',
    },
    {
      caseNumber: 'CASE-1005',
      reportType: 'Literature',
      product: 'HepatoShield',
      eventSummary: 'Mild Pruritus without jaundice reported in ongoing retrospective cohort',
      seriousness: 'Non-Serious',
      status: 'data_entry',
      assignedTo: dataEntryUser?._id,
      regulatoryDueDate: new Date(now + 11 * dayMs),
      receivedDate: new Date(now - 2 * dayMs),
      patientAge: 62,
      patientGender: 'Female',
    },
    {
      caseNumber: 'CASE-1006',
      reportType: 'Spontaneous',
      product: 'Dermacure',
      eventSummary: 'Localised Contact Dermatitis resolving upon treatment discontinuation',
      seriousness: 'Non-Serious',
      status: 'completed',
      assignedTo: reviewerUser?._id,
      regulatoryDueDate: new Date(now - 2 * dayMs),
      receivedDate: new Date(now - 14 * dayMs),
      patientAge: 24,
      patientGender: 'Female',
    },
    {
      caseNumber: 'CASE-1007',
      reportType: 'Clinical Trial',
      product: 'CardioGuard',
      eventSummary: 'Severe Hypotensive Episode with bradycardia in Phase II study',
      seriousness: 'Serious',
      status: 'closed',
      assignedTo: reviewerUser?._id,
      regulatoryDueDate: new Date(now - 5 * dayMs),
      receivedDate: new Date(now - 20 * dayMs),
      patientAge: 67,
      patientGender: 'Male',
    },
    {
      caseNumber: 'CASE-1008',
      reportType: 'Health Authority',
      product: 'NeuroCalm',
      eventSummary: 'Severe Tremor and extrapyramidal symptoms query from regional health office',
      seriousness: 'Serious',
      status: 'medical_review',
      assignedTo: reviewerUser?._id,
      regulatoryDueDate: new Date(now + 6 * dayMs),
      receivedDate: new Date(now - 3 * dayMs),
      patientAge: 51,
      patientGender: 'Female',
    },
    {
      caseNumber: 'CASE-1009',
      reportType: 'Spontaneous',
      product: 'Medicine A',
      eventSummary: 'Bilateral Peripheral Edema observed after 14 days of continuous administration',
      seriousness: 'Non-Serious',
      status: 'quality_review',
      assignedTo: reviewerUser?._id,
      regulatoryDueDate: new Date(now + 4 * dayMs),
      receivedDate: new Date(now - 6 * dayMs),
      patientAge: 49,
      patientGender: 'Male',
    },
    {
      caseNumber: 'CASE-1010',
      reportType: 'Spontaneous',
      product: 'HepatoShield',
      eventSummary: 'Acute Gastrointestinal Cramping and nausea reported directly by consumer',
      seriousness: 'Non-Serious',
      status: 'new',
      assignedTo: null, // Unassigned queue
      regulatoryDueDate: new Date(now + 14 * dayMs),
      receivedDate: new Date(now - 1 * dayMs),
      patientAge: 33,
      patientGender: 'Female',
    },
    {
      caseNumber: 'CASE-1011',
      reportType: 'Post-Marketing',
      product: 'CardioGuard',
      eventSummary: 'Intermittent Palpitations during physical exercise',
      seriousness: 'Non-Serious',
      status: 'completed',
      assignedTo: reviewerUser?._id,
      regulatoryDueDate: new Date(now - 1 * dayMs),
      receivedDate: new Date(now - 18 * dayMs),
      patientAge: 42,
      patientGender: 'Male',
    },
    {
      caseNumber: 'CASE-1012',
      reportType: 'Spontaneous',
      product: 'Dermacure',
      eventSummary: 'Mild Scalp Scaling and redness',
      seriousness: 'Non-Serious',
      status: 'data_entry',
      assignedTo: dataEntryUser?._id,
      regulatoryDueDate: new Date(now + 8 * dayMs),
      receivedDate: new Date(now - 2 * dayMs),
      patientAge: 31,
      patientGender: 'Female',
    },
  ];

  const caseMap = new Map();
  for (const c of demoCases) {
    const saved = await Case.findOneAndUpdate(
      { caseNumber: c.caseNumber },
      { $set: c },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    caseMap.set(saved.caseNumber, saved);
  }

  logger.info(`✓ Seeded ${demoCases.length} adverse event cases`);

  // ── Action Items ──────────────────────────────────────────
  const demoActions = [
    {
      caseId: caseMap.get('CASE-1002')?._id,
      caseNumber: 'CASE-1002',
      title: 'Formal Medical Causality Assessment',
      description: 'Review hospital admission notes and assess WHO-UMC causality score.',
      owner: reviewerUser?._id,
      dueOn: new Date(now - 1 * dayMs), // Yesterday -> OVERDUE in Asia/Kolkata
      status: 'pending',
    },
    {
      caseId: caseMap.get('CASE-1003')?._id,
      caseNumber: 'CASE-1003',
      title: 'Request Laboratory Follow-up Records',
      description: 'Contact clinic to request vestibular testing and complete blood count.',
      owner: reviewerUser?._id,
      dueOn: new Date(now), // Due Today
      status: 'in_progress',
    },
    {
      caseId: caseMap.get('CASE-1008')?._id,
      caseNumber: 'CASE-1008',
      title: 'Draft 7-Day Expedited Authority Report',
      description: 'Compile ICSR XML envelope and medical narrative for regulatory submission.',
      owner: reviewerUser?._id,
      dueOn: new Date(now + 1 * dayMs), // Due Tomorrow
      status: 'pending',
    },
    {
      caseId: caseMap.get('CASE-1004')?._id,
      caseNumber: 'CASE-1004',
      title: 'Quality Gate: Clinical Validation Sign-off',
      description: 'Verify MedDRA coding for liver enzyme elevation before regulatory transmission.',
      owner: managerUser?._id,
      dueOn: new Date(now + 2 * dayMs), // Due Soon
      status: 'pending',
    },
    {
      caseId: caseMap.get('CASE-1005')?._id,
      caseNumber: 'CASE-1005',
      title: 'Obtain Primary Reporter De-challenge Confirmation',
      description: 'Confirm if symptoms abated after dose reduction.',
      owner: dataEntryUser?._id,
      dueOn: new Date(now + 3 * dayMs),
      status: 'pending',
    },
    {
      caseId: caseMap.get('CASE-1009')?._id,
      caseNumber: 'CASE-1009',
      title: 'Investigate Prior Cardiac Risk Factors',
      description: 'Check patient past medical history for pre-existing venous insufficiency.',
      owner: reviewerUser?._id,
      dueOn: new Date(now + 4 * dayMs),
      status: 'pending',
    },
    {
      caseId: caseMap.get('CASE-1006')?._id,
      caseNumber: 'CASE-1006',
      title: 'Verify Closed Case Documentation Archival',
      description: 'Confirm all source PDFs and regulatory dispatch receipts are linked.',
      owner: reviewerUser?._id,
      dueOn: new Date(now - 3 * dayMs),
      status: 'completed',
    },
  ];

  for (const a of demoActions) {
    if (a.caseId) {
      await ActionItem.findOneAndUpdate(
        { caseNumber: a.caseNumber, title: a.title },
        { $set: a },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
  }
  logger.info(`✓ Seeded ${demoActions.length} action items`);

  // ── Audit Events ──────────────────────────────────────────
  const auditLogs = [
    {
      actorId: dataEntryUser?._id,
      actorEmail: dataEntryUser?.email,
      actorRole: 'data_entry',
      action: 'CASE_INTAKE',
      entity: 'Case',
      entityId: caseMap.get('CASE-1001')?._id,
      summary: 'Initial spontaneous case intake recorded for Medicine A',
      details: { caseNumber: 'CASE-1001', product: 'Medicine A' },
      timestamp: new Date(now - 25 * 60 * 1000), // 25 min ago
    },
    {
      actorId: managerUser?._id,
      actorEmail: managerUser?.email,
      actorRole: 'case_manager',
      action: 'CASE_ASSIGNMENT',
      entity: 'Case',
      entityId: caseMap.get('CASE-1002')?._id,
      summary: 'Case CASE-1002 assigned to Dr. Robert Reviewer for expedited assessment',
      details: { caseNumber: 'CASE-1002', assignee: reviewerUser?.email },
      timestamp: new Date(now - 50 * 60 * 1000), // 50 min ago
    },
    {
      actorId: reviewerUser?._id,
      actorEmail: reviewerUser?.email,
      actorRole: 'reviewer',
      action: 'MEDICAL_REVIEW_START',
      entity: 'Case',
      entityId: caseMap.get('CASE-1003')?._id,
      summary: 'Medical review opened for CASE-1003 (NeuroCalm)',
      details: { caseNumber: 'CASE-1003' },
      timestamp: new Date(now - 90 * 60 * 1000), // 1.5 hr ago
    },
    {
      actorId: reviewerUser?._id,
      actorEmail: reviewerUser?.email,
      actorRole: 'reviewer',
      action: 'ACTION_ITEM_CREATE',
      entity: 'ActionItem',
      entityId: caseMap.get('CASE-1002')?._id,
      summary: 'New task created: Formal Medical Causality Assessment for CASE-1002',
      details: { caseNumber: 'CASE-1002', dueOn: 'Urgent' },
      timestamp: new Date(now - 3 * 60 * 60 * 1000),
    },
    {
      actorId: adminUser?._id,
      actorEmail: adminUser?.email,
      actorRole: 'admin',
      action: 'SYSTEM_CONFIG_CHECK',
      entity: 'System',
      entityId: null,
      summary: 'System integrity and database compliance check verified',
      details: { status: 'healthy' },
      timestamp: new Date(now - 5 * 60 * 60 * 1000),
    },
  ];

  await AuditEvent.insertMany(auditLogs);
  logger.info(`✓ Seeded ${auditLogs.length} audit trail activity records`);

  // ── Seed Demo Intakes ─────────────────────────────────────
  const demoIntakes = [
    {
      intakeNumber: 'INT-2026-00001',
      source: 'physician',
      receiptDate: new Date(now - 1 * dayMs),
      reporter: {
        name: 'Dr. Sunita Sharma',
        qualification: 'Physician',
        contact: 'sunita.sharma@hospital.org',
        country: 'India',
      },
      patient: {
        reference: 'PT-8801',
        age: 46,
        ageUnit: 'years',
        sex: 'Female',
        weight: 64,
      },
      suspectedProduct: 'Medicine A',
      reportedReaction: 'Severe Maculopapular Rash across torso after second cycle',
      narrative: 'Patient presented to clinic 48h after commencing dose with extensive erythematous rash.',
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
        duplicateCandidates: [],
      },
      createdBy: dataEntryUser?._id,
    },
    {
      intakeNumber: 'INT-2026-00002',
      source: 'patient',
      receiptDate: new Date(now - 2 * dayMs),
      reporter: {
        name: 'Anonymous Consumer',
        qualification: 'Consumer/Patient',
        contact: '',
        country: 'India',
      },
      patient: {
        reference: '', // Missing patient identifier
        age: null,
        ageUnit: 'years',
        sex: 'Unknown',
        weight: null,
      },
      suspectedProduct: 'NeuroCalm',
      reportedReaction: 'Tremors and sleep disturbance',
      narrative: 'Consumer called hotline reporting hands shaking. Refused to provide age or personal initials.',
      status: 'INCOMPLETE',
      validation: {
        hasMinimumCriteria: false,
        missingFields: ['Identifiable Patient (Reference ID, Age, or Sex)'],
        criteriaStatus: {
          identifiableReporter: true,
          identifiablePatient: false,
          suspectProduct: true,
          reportedEvent: true,
        },
        duplicateCandidates: [],
      },
      createdBy: dataEntryUser?._id,
    },
    {
      intakeNumber: 'INT-2026-00003',
      source: 'literature',
      receiptDate: new Date(now - 6 * dayMs),
      reporter: {
        name: 'Journal of Clinical Pharmacology',
        qualification: 'Other',
        contact: 'doi:10.1016/j.clinpharm.2026.04',
        country: 'India',
      },
      patient: {
        reference: 'LIT-CASE-4',
        age: 58,
        ageUnit: 'years',
        sex: 'Male',
        weight: 78,
      },
      suspectedProduct: 'CardioGuard',
      reportedReaction: 'Sinus Bradycardia following concomitant beta-blocker administration',
      narrative: 'Case study report from multi-center study on antihypertensive therapy.',
      status: 'CONVERTED',
      convertedCaseNumber: 'CASE-1002',
      validation: {
        hasMinimumCriteria: true,
        missingFields: [],
        criteriaStatus: {
          identifiableReporter: true,
          identifiablePatient: true,
          suspectProduct: true,
          reportedEvent: true,
        },
        duplicateCandidates: [],
      },
      createdBy: managerUser?._id,
    },
    {
      intakeNumber: 'INT-2026-00004',
      source: 'other',
      receiptDate: new Date(now - 5 * dayMs),
      reporter: {
        name: 'Spam Marketing Webform',
        qualification: 'Other',
        contact: 'promo@unrelated.net',
        country: 'Unknown',
      },
      patient: {
        reference: '',
        age: null,
        ageUnit: 'years',
        sex: 'Unknown',
        weight: null,
      },
      suspectedProduct: 'Unknown Supplement',
      reportedReaction: 'Unsubstantiated commercial solicitation',
      narrative: 'Commercial spam submitted through safety portal webform.',
      status: 'REJECTED',
      rejectionReason: 'Non-pharmacovigilance submission: promotional solicitation with zero safety event details.',
      validation: {
        hasMinimumCriteria: false,
        missingFields: ['Identifiable Patient', 'Suspected Medicinal Product'],
        criteriaStatus: {
          identifiableReporter: true,
          identifiablePatient: false,
          suspectProduct: false,
          reportedEvent: false,
        },
        duplicateCandidates: [],
      },
      createdBy: adminUser?._id,
    },
  ];

  for (const intakeDef of demoIntakes) {
    await Intake.findOneAndUpdate(
      { intakeNumber: intakeDef.intakeNumber },
      { $set: intakeDef },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  logger.info(`✓ Seeded ${demoIntakes.length} demo intake records`);
}

// Allow direct execution: `node src/seeds/seed.js`
if (process.argv[1]?.endsWith('seed.js')) {
  mongoose
    .connect(config.mongoUri)
    .then(async () => {
      await seedDatabase();
      await mongoose.connection.close();
      logger.info('Database seeding completed.');
      process.exit(0);
    })
    .catch((err) => {
      logger.fatal({ err }, 'Database seeding failed');
      process.exit(1);
    });
}
