import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import mongoose from 'mongoose';
import { config } from './config/index.js';
import { mountRoutes } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { Role } from './models/Role.js';
import { seedDatabase } from './seeds/seed.js';
import { logger } from './utils/logger.js';

const app = express();

// ── Security Headers ──────────────────────────────────────────
app.use(helmet());

// ── Trust Proxy (required for Vercel & reverse proxies) ──────
app.set('trust proxy', 1);

// ── CORS — allow configured client origin, local dev, and Vercel domains ─
const allowedOrigins = [
  config.clientOrigin,
  'http://localhost:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        !config.isProduction
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true, // allow httpOnly cookies
  }),
);

// ── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// ── Body Parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Cookie Parser ─────────────────────────────────────────────
app.use(cookieParser());

// ── HTTP Request Logging ──────────────────────────────────────
if (!config.isProduction) {
  app.use(morgan('dev'));
}

// ── Ensure MongoDB Connection (required for Vercel Serverless / Service runs) ──
let isConnected = false;
let isConnecting = false;

async function ensureDatabaseConnected() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  if (isConnecting) {
    for (let i = 0; i < 25; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (mongoose.connection.readyState === 1) {
        isConnected = true;
        return;
      }
    }
  }

  isConnecting = true;
  try {
    const uri = config.mongoUri;
    if (!uri) {
      throw new Error('MONGO_URI is missing from environment variables.');
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    isConnected = true;
    isConnecting = false;
    logger.info('✓ MongoDB connected successfully via request middleware');

    // Auto-seed if database is empty
    try {
      const roleCount = await Role.countDocuments();
      if (roleCount === 0) {
        await seedDatabase();
      }
    } catch (seedErr) {
      logger.warn({ seedErr }, 'Auto-seed check notice');
    }
  } catch (err) {
    isConnecting = false;
    throw err;
  }
}

app.use(async (req, res, next) => {
  // Always allow health checks through even if DB is reconnecting
  if (req.path === '/api/health' || req.path === '/health') {
    return next();
  }

  try {
    await ensureDatabaseConnected();
    next();
  } catch (err) {
    logger.error({ err }, 'MongoDB connection error during request');
    return res.status(503).json({
      success: false,
      error: `Database connection failed: ${err.message}. Please verify your MongoDB Atlas credentials and ensure Atlas Network Access allows 0.0.0.0/0.`,
    });
  }
});

// ── API Routes ────────────────────────────────────────────────
mountRoutes(app);

// ── 404 Catch-All ─────────────────────────────────────────────
app.use(notFoundHandler);

// ── Central Error Handler (must be last) ──────────────────────
app.use(errorHandler);

export default app;
