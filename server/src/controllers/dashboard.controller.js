import { getDashboardSummary } from '../services/dashboard.service.js';

/**
 * Controller to fetch aggregated dashboard summary metrics.
 */
export async function getSummary(req, res, next) {
  try {
    const { timeRange } = req.query;
    const summary = await getDashboardSummary(req.user, { timeRange });
    return res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
}
