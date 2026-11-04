import * as workflowService from '../services/workflow.service.js';

/**
 * POST /api/cases/:id/route
 * Validates transition, role, and checks, then atomically moves the case.
 */
export async function routeCaseHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { targetStage, reason } = req.body;
    const result = await workflowService.routeCase(id, { targetStage, reason }, req.user, req);

    return res.json({
      success: true,
      message: `Case ${result.case.caseNumber} successfully routed to ${result.to}.`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/cases/:id/workflow
 * Returns current stage, allowed transitions, check results, and history.
 */
export async function getCaseWorkflowHandler(req, res, next) {
  try {
    const { id } = req.params;
    const details = await workflowService.getCaseWorkflowDetails(id);
    return res.json({
      success: true,
      ...details,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tasks/my
 * Returns active workflow tasks assigned to current user.
 */
export async function getMyTasksHandler(req, res, next) {
  try {
    const tasks = await workflowService.getMyTasks(req.user);
    return res.json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/tasks/team
 * Returns team tasks and workload breakdown per user.
 */
export async function getTeamTasksHandler(req, res, next) {
  try {
    const result = await workflowService.getTeamTasks();
    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/tasks/:id/reassign
 * Reassigns task to a new user (Manager only).
 */
export async function reassignTaskHandler(req, res, next) {
  try {
    const { id } = req.params;
    const { assignedTo, reason } = req.body;
    const task = await workflowService.reassignTask(id, { assignedTo, reason }, req.user, req);

    return res.json({
      success: true,
      message: `Task reassigned to ${task.assignedToName} successfully.`,
      task,
    });
  } catch (err) {
    next(err);
  }
}

