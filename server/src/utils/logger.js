import pino from 'pino';
import { config } from '../config/index.js';

/**
 * Application-wide Pino logger.
 * Pretty-prints in development; JSON in production.
 */
export const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  transport: config.isProduction
    ? undefined
    : {
        target: 'pino/file',
        options: { destination: 1 }, // stdout
      },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
