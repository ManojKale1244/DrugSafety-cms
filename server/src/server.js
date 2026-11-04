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
  // Always bind the HTTP listener immediately so Vercel Services & cloud reverse proxies detect the port as open
  const server = app.listen(port, () => {
    logger.info(`✓ Server listening on http://localhost:${port} (${config.nodeEnv})`);
  });

  // Connect to MongoDB in background; request middleware will also ensure connection on incoming routes
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    logger.info(`✓ MongoDB connected → ${mongoUri.replace(/\/\/.*@/, '//<credentials>@')}`);

    // Auto-seed if database has no roles yet
    const roleCount = await Role.countDocuments();
    if (roleCount === 0) {
      await seedDatabase();
    }
  } catch (connErr) {
    if (mongoUri.includes('mongodb+srv://') || mongoUri !== 'mongodb://localhost:27017/drug-safety-cms') {
      const localUri = 'mongodb://localhost:27017/drug-safety-cms';
      logger.warn(
        `Could not connect to remote MongoDB (${connErr.message}). Attempting fallback to local MongoDB at ${localUri}...`,
      );
      try {
        await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
        logger.info(`✓ Connected to local MongoDB fallback → ${localUri}`);
      } catch (localErr) {
        logger.warn(`Local MongoDB fallback also unavailable: ${localErr.message}. Server is running and will retry on requests.`);
      }
    } else {
      logger.warn(`Initial MongoDB connection failed: ${connErr.message}. Server is running and will retry on requests.`);
    }
  }

  // ── Graceful Shutdown ───────────────────────────────────
  /** @param {string} signal */
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully…`);
    server.close(async () => {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close(false);
      }
      logger.info('Server and MongoDB connection closed.');
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
}

start();
