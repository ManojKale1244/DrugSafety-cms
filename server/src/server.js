import mongoose from 'mongoose';

import app from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { Role } from './models/Role.js';
import { seedDatabase } from './seeds/seed.js';

const { port, mongoUri } = config;

/**
 * Connect to MongoDB and start the HTTP server.
 * Registers handlers for graceful shutdown on SIGTERM / SIGINT.
 */
async function start() {
  try {
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
      logger.info(`✓ MongoDB connected → ${mongoUri.replace(/\/\/.*@/, '//<credentials>@')}`);
    } catch (connErr) {
      if (mongoUri.includes('mongodb+srv://') || mongoUri !== 'mongodb://localhost:27017/drug-safety-cms') {
        const localUri = 'mongodb://localhost:27017/drug-safety-cms';
        logger.warn(
          `Could not connect to remote MongoDB (${connErr.message}). Attempting fallback to local MongoDB at ${localUri}...`,
        );
        await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
        logger.info(`✓ Connected to local MongoDB fallback → ${localUri}`);
      } else {
        throw connErr;
      }
    }

    // Auto-seed if database has no roles yet
    const roleCount = await Role.countDocuments();
    if (roleCount === 0) {
      await seedDatabase();
    }

    const server = app.listen(port, () => {
      logger.info(`✓ Server listening on http://localhost:${port}  (${config.nodeEnv})`);
    });

    // ── Graceful Shutdown ───────────────────────────────────
    /** @param {string} signal */
    const shutdown = async (signal) => {
      logger.info(`${signal} received — shutting down gracefully…`);
      server.close(async () => {
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed.');
        process.exit(0);
      });

      // Force exit after 10 s if graceful shutdown stalls
      setTimeout(() => {
        logger.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();
