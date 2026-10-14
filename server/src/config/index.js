import 'dotenv/config';

/**
 * Centralised application configuration.
 * Every value falls back to a safe default for local development.
 */
export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri:
    process.env.TEST_MONGO_URI ||
    (process.env.NODE_ENV === 'test'
      ? 'mongodb://localhost:27017/drug-safety-cms-test'
      : process.env.MONGO_URI || 'mongodb://localhost:27017/drug-safety-cms'),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',

  /** Convenience flag */
  get isProduction() {
    return this.nodeEnv === 'production';
  },
};
