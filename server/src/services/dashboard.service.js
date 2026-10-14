import { Case } from '../models/Case.js';
import { ActionItem } from '../models/ActionItem.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { User } from '../models/User.js';
import { isTaskOverdue, getTaskUrgency } from '../utils/dateUtils.js';

/**
 * Calculates dashboard metrics and aggregations scoped by user permissions.
 *
 * @param {import('../models/User.js').User} user Current authenticated user
 * @param {Object} [options]
 * @param {string} [options.timeRange='30d'] '7d' | '14d' | '30d' | '90d'
 */
export async function getDashboardSummary(user, { timeRange: _timeRange = '30d' } = {}) {
  const roleName = user.roleId?.name || user.role?.name || 'viewer';
  const userId = user._id;

  // High-level oversight roles see organization-wide metrics
  const isGlobalViewer = ['admin', 'case_manager', 'qa_specialist', 'regulatory_affairs'].includes(roleName);

  // Determine Case scoping query
  const caseScope = isGlobalViewer
    ? {}
    : { assignedTo: userId };

  // Determine Action Item scoping query
  const actionScope = isGlobalViewer
    ? {}
    : { owner: userId };

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const sevenDaysAgo = new Date(now.getTime() - 7 * dayMs);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * dayMs);
  const sevenDaysAhead = new Date(now.getTime() + 7 * dayMs);

  // ── 1. Case Counts via Aggregation ─────────────────────────
  const caseMetricsPromise = Case.aggregate([
    { $match: caseScope },
    {
      $group: {
        _id: null,
        totalCases: { $sum: 1 },
        newCases7d: {
          $sum: {
            $cond: [{ $gte: ['$receivedDate', sevenDaysAgo] }, 1, 0],
          },
        },
        newCases30d: {
          $sum: {
            $cond: [{ $gte: ['$receivedDate', thirtyDaysAgo] }, 1, 0],
          },
        },
        awaitingMedicalReview: {
          $sum: {
            $cond: [{ $eq: ['$status', 'medical_review'] }, 1, 0],
          },
        },
        awaitingQualityReview: {
          $sum: {
            $cond: [{ $eq: ['$status', 'quality_review'] }, 1, 0],
          },
        },
        completedCases: {
          $sum: {
            $cond: [{ $in: ['$status', ['completed', 'closed']] }, 1, 0],
          },
        },
        dueForReporting7d: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gte: ['$regulatoryDueDate', now] },
                  { $lte: ['$regulatoryDueDate', sevenDaysAhead] },
                  { $not: [{ $in: ['$status', ['completed', 'closed']] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  // ── 2. Cases by Status for Donut Chart ─────────────────────
  const casesByStatusPromise = Case.aggregate([
    { $match: caseScope },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  // ── 3. Action Items: Overdue & My Tasks ─────────────────────
  const actionItemsPromise = ActionItem.find(actionScope)
    .populate('owner', 'name email')
    .sort({ dueOn: 1 });

  // ── 4. Workload Per User (Only visible to managers/admins, or self for processor) ──
  const workloadUserQuery = isGlobalViewer
    ? { status: 'active' }
    : { _id: userId };

  const targetUsersPromise = User.find(workloadUserQuery)
    .populate('roleId', 'name displayName')
    .select('name email roleId');

  // ── 5. 14-Day Intake & Completion Trend ─────────────────────
  const fourteenDaysAgo = new Date(now.getTime() - 14 * dayMs);
  const trendPromise = Case.aggregate([
    {
      $match: {
        ...caseScope,
        $or: [
          { receivedDate: { $gte: fourteenDaysAgo } },
          { updatedAt: { $gte: fourteenDaysAgo }, status: { $in: ['completed', 'closed'] } },
        ],
      },
    },
    {
      $project: {
        receivedDate: 1,
        updatedAt: 1,
        status: 1,
      },
    },
  ]);

  // ── 6. Recent Activity Audit Trail ─────────────────────────
  const auditFilter = isGlobalViewer
    ? {}
    : {
        $or: [
          { actorId: userId },
          { 'details.assignee': user.email },
        ],
      };

  const auditEventsPromise = AuditEvent.find(auditFilter)
    .sort({ timestamp: -1 })
    .limit(15);

  // Execute all aggregations in parallel
  const [
    [caseMetrics = {}],
    casesByStatusRaw,
    actionItems,
    targetUsers,
    trendRaw,
    recentActivity,
  ] = await Promise.all([
    caseMetricsPromise,
    casesByStatusPromise,
    actionItemsPromise,
    targetUsersPromise,
    trendPromise,
    auditEventsPromise,
  ]);

  // Process Action Items: Overdue count & Tasks list
  let overdueActionsCount = 0;
  const userTasks = [];

  for (const item of actionItems) {
    const isOverdue = isTaskOverdue(item.dueOn, item.status);
    const urgency = getTaskUrgency(item.dueOn, item.status);

    if (isOverdue) {
      overdueActionsCount++;
    }

    // Include in "My Tasks" if owned by current user and not completed
    if (item.owner?._id?.toString() === userId.toString() && item.status !== 'completed') {
      userTasks.push({
        id: item._id,
        caseId: item.caseId,
        caseNumber: item.caseNumber,
        title: item.title,
        description: item.description,
        dueOn: item.dueOn,
        status: item.status,
        isOverdue,
        urgency,
      });
    }
  }

  // Sort user tasks: overdue first, then due today, then soonest
  userTasks.sort((a, b) => {
    const score = (t) => (t.urgency === 'overdue' ? 0 : t.urgency === 'due_today' ? 1 : 2);
    if (score(a) !== score(b)) return score(a) - score(b);
    return new Date(a.dueOn) - new Date(b.dueOn);
  });

  // Format Cases by Status
  const STATUS_CONFIG = {
    new: { label: 'New Intake', color: '#6366f1' },
    data_entry: { label: 'Data Entry', color: '#f97316' },
    medical_review: { label: 'Medical Review', color: '#3b82f6' },
    quality_review: { label: 'Quality Review', color: '#f59e0b' },
    completed: { label: 'Completed', color: '#10b981' },
    closed: { label: 'Closed / Archived', color: '#6b7280' },
  };

  const statusMap = new Map(casesByStatusRaw.map((s) => [s._id, s.count]));
  const casesByStatus = Object.entries(STATUS_CONFIG).map(([key, config]) => ({
    status: key,
    label: config.label,
    count: statusMap.get(key) || 0,
    color: config.color,
  }));

  // Workload Per User calculation
  // Find case counts assigned to each user
  const userCaseCounts = await Case.aggregate([
    { $match: { assignedTo: { $ne: null } } },
    {
      $group: {
        _id: '$assignedTo',
        activeCases: {
          $sum: {
            $cond: [{ $not: [{ $in: ['$status', ['completed', 'closed']] }] }, 1, 0],
          },
        },
        completedCases: {
          $sum: {
            $cond: [{ $in: ['$status', ['completed', 'closed']] }, 1, 0],
          },
        },
      },
    },
  ]);
  const userCaseMap = new Map(userCaseCounts.map((u) => [u._id.toString(), u]));

  // Action item counts per user
  const userActionMap = new Map();
  for (const item of actionItems) {
    const oId = item.owner?._id?.toString() || item.owner?.toString();
    if (!oId) continue;
    if (!userActionMap.has(oId)) {
      userActionMap.set(oId, { open: 0, overdue: 0 });
    }
    const rec = userActionMap.get(oId);
    if (item.status !== 'completed') {
      rec.open++;
      if (isTaskOverdue(item.dueOn, item.status)) {
        rec.overdue++;
      }
    }
  }

  const workloadPerUser = targetUsers
    .filter((u) => ['reviewer', 'case_manager', 'data_entry'].includes(u.roleId?.name))
    .map((u) => {
      const uId = u._id.toString();
      const caseData = userCaseMap.get(uId) || { activeCases: 0, completedCases: 0 };
      const actionData = userActionMap.get(uId) || { open: 0, overdue: 0 };
      return {
        userId: u._id,
        name: u.name,
        email: u.email,
        roleName: u.roleId?.name || 'reviewer',
        roleDisplayName: u.roleId?.displayName || 'Reviewer',
        activeCases: caseData.activeCases,
        completedCases: caseData.completedCases,
        openActions: actionData.open,
        overdueActions: actionData.overdue,
      };
    })
    .sort((a, b) => b.activeCases - a.activeCases);

  // Generate 14-day chronological trend map
  const trend14d = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * dayMs);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let intakeCount = 0;
    let completedCount = 0;

    for (const c of trendRaw) {
      if (c.receivedDate && c.receivedDate.toISOString().startsWith(dateStr)) {
        intakeCount++;
      }
      if (
        c.updatedAt &&
        ['completed', 'closed'].includes(c.status) &&
        c.updatedAt.toISOString().startsWith(dateStr)
      ) {
        completedCount++;
      }
    }

    trend14d.push({
      date: dateStr,
      label: dayLabel,
      intake: intakeCount,
      completed: completedCount,
    });
  }

  // Final summary object
  return {
    success: true,
    userRole: roleName,
    isGlobalScope: isGlobalViewer,
    summary: {
      totalCases: caseMetrics.totalCases || 0,
      newCases7d: caseMetrics.newCases7d || 0,
      newCases30d: caseMetrics.newCases30d || 0,
      awaitingMedicalReview: caseMetrics.awaitingMedicalReview || 0,
      awaitingQualityReview: caseMetrics.awaitingQualityReview || 0,
      overdueActions: overdueActionsCount,
      dueForReporting7d: caseMetrics.dueForReporting7d || 0,
      completedCases: caseMetrics.completedCases || 0,
    },
    casesByStatus,
    workloadPerUser,
    trend14d,
    myTasks: userTasks.slice(0, 10),
    recentActivity: recentActivity.map((a) => ({
      id: a._id,
      actorEmail: a.actorEmail,
      actorRole: a.actorRole,
      action: a.action,
      entity: a.entity,
      summary: a.summary,
      timestamp: a.timestamp,
    })),
  };
}
