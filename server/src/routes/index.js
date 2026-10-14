import { Router } from 'express';
import healthRouter from './health.js';
import authRouter from './auth.routes.js';
import userRouter from './user.routes.js';
import dashboardRouter from './dashboard.routes.js';
import intakeRouter from './intake.routes.js';
import caseRouter from './case.routes.js';

/**
 * Mount all API route groups under /api.
 *
 * @param {import('express').Application} app
 */
export function mountRoutes(app) {
  const api = Router();

  api.use('/health', healthRouter);
  api.use('/auth', authRouter);
  api.use('/users', userRouter);
  api.use('/dashboard', dashboardRouter);
  api.use('/intakes', intakeRouter);
  api.use('/cases', caseRouter);

  app.use('/api', api);
}
