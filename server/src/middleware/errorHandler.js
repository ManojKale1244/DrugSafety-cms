import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

/**
 * Express central error-handling middleware (4-arg signature).
 * - Logs the error server-side.
 * - Returns a safe JSON response (no stack trace in production).
 *
 * @param {Error} err
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  logger.error({ err, statusCode }, message);

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(config.isProduction ? {} : { stack: err.stack }),
  });
}

/**
 * Catch-all 404 handler for unmatched routes.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
}
