import api from './api';

/**
 * Duplicate Detection Client Service
 */

/**
 * Fetch duplicate candidate queue
 */
export async function fetchDuplicateQueue({ decision, sortBy = 'score', order = 'desc', page = 1, limit = 50 } = {}) {
  const params = { sortBy, order, page, limit };
  if (decision && decision !== 'ALL') {
    params.decision = decision;
  }
  const response = await api.get('/duplicates/queue', { params });
  return response.data;
}

/**
 * Fetch a single duplicate review record by ID
 */
export async function fetchDuplicateReview(id) {
  const response = await api.get(`/duplicates/${id}`);
  return response.data;
}

/**
 * Trigger duplicate screening for a case or custom payload
 */
export async function triggerDuplicateCheck(payload) {
  const response = await api.post('/duplicates/check', payload);
  return response.data;
}

/**
 * Record a human decision on a duplicate pair.
 * Never auto-merges or auto-dismisses. Reason is mandatory.
 */
export async function recordDuplicateDecision(id, { decision, reason }) {
  const response = await api.post(`/duplicates/${id}/decide`, { decision, reason });
  return response.data;
}
