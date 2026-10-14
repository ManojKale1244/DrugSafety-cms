import { AuditEvent } from '../models/AuditEvent.js';
import { logger } from './logger.js';

/**
 * Record an immutable audit log entry.
 *
 * @param {Object} params
 * @param {import('../models/User.js').User|null} [params.actor] User performing the action
 * @param {string} params.action Action identifier (e.g., 'AUTH_LOGIN_SUCCESS', 'USER_STATUS_CHANGE')
 * @param {string} params.entity Name of the target entity (e.g., 'User', 'Role', 'Case')
 * @param {string} [params.entityId] ID of the entity acted on
 * @param {string} params.summary Human-readable summary of the action
 * @param {Object} [params.details] Additional before/after or payload details
 * @param {import('express').Request} [params.req] Optional request to extract IP and user agent
 */
export async function recordAudit({
  actor = null,
  action,
  entity,
  entityType,
  entityId = null,
  summary,
  details = {},
  meta = null,
  req = null,
}) {
  try {
    const finalEntity = entity || entityType || 'System';
    const finalDetails = meta && Object.keys(details).length === 0 ? meta : details;

    const ip = req
      ? req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket?.remoteAddress || 'unknown'
      : 'unknown';
    const userAgent = req?.headers['user-agent'] || 'unknown';

    await AuditEvent.create({
      actorId: actor?._id || actor?.id || null,
      actorEmail: actor?.email || 'system',
      actorRole: actor?.role?.name || actor?.roleName || 'system',
      action,
      entity: finalEntity,
      entityId: entityId ? String(entityId) : null,
      summary,
      details: finalDetails,
      ip,
      userAgent,
      timestamp: new Date(),
    });
  } catch (error) {
    // Audit logging must not crash main operations, but must be logged to pino
    logger.error({ err: error, action, entity }, 'Failed to write AuditEvent');
  }
}
