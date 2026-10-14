import mongoose from 'mongoose';
import app from '../server/src/app.js';
import { config } from '../server/src/config/index.js';
import { Role } from '../server/src/models/Role.js';
import { seedDatabase } from '../server/src/seeds/seed.js';

let isConnected = false;

/**
 * Connect to MongoDB Atlas with connection caching for serverless lambdas.
 */
async function connectToDatabase() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  if (!config.mongoUri) {
    throw new Error('MONGO_URI environment variable is missing.');
  }

  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 8000,
  });
  isConnected = true;

  // Auto-seed database if empty (creates initial roles and admin account)
  try {
    const roleCount = await Role.countDocuments();
    if (roleCount === 0) {
      await seedDatabase();
    }
  } catch (seedErr) {
    console.warn('Auto-seed check notice:', seedErr.message);
  }
}

/**
 * Vercel Serverless Function Handler
 */
export default async function handler(req, res) {
  try {
    await connectToDatabase();
  } catch (dbErr) {
    console.error('MongoDB Atlas connection failed:', dbErr);
    return res.status(500).json({
      success: false,
      error: 'Database connection failed. Please ensure MONGO_URI is set in Vercel environment variables and Atlas IP whitelist includes 0.0.0.0/0.',
    });
  }

  // Ensure request URL preserves the /api route prefix for Express route mounting
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + req.url;
  }

  return app(req, res);
}
