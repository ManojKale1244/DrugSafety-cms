import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { config } from './config/index.js';
import { mountRoutes } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

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

// ── API Routes ────────────────────────────────────────────────
mountRoutes(app);

// ── 404 Catch-All ─────────────────────────────────────────────
app.use(notFoundHandler);

// ── Central Error Handler (must be last) ──────────────────────
app.use(errorHandler);

export default app;
