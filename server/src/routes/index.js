import { Router } from 'express';
import healthRouter from './health.js';
import authRouter from './auth.routes.js';
import userRouter from './user.routes.js';
import dashboardRouter from './dashboard.routes.js';
import intakeRouter from './intake.routes.js';
import caseRouter from './case.routes.js';
import duplicateRouter from './duplicate.routes.js';
import codingRouter from './coding.routes.js';
import assessmentRouter from './assessment.routes.js';
import taskRouter from './task.routes.js';
import qualityRouter from './quality.routes.js';
import reportingRouter from './reporting.routes.js';
import icsrRouter from './icsr.routes.js';
import followUpRouter from './followUp.routes.js';
import productRouter from './product.routes.js';
import complianceRouter from './compliance.routes.js';
import aggregateReportRouter from './aggregateReport.routes.js';
import attachmentRouter from './attachment.routes.js';

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
  api.use('/duplicates', duplicateRouter);
  api.use('/coding', codingRouter);
  api.use('/assessments', assessmentRouter);
  api.use('/tasks', taskRouter);
  api.use('/quality', qualityRouter);
  api.use('/reports', reportingRouter);
  api.use('/icsr', icsrRouter);
  api.use('/follow-ups', followUpRouter);
  api.use('/products', productRouter);
  api.use('/compliance', complianceRouter);
  api.use('/aggregate-reports', aggregateReportRouter);
  api.use('/', attachmentRouter);

  app.use('/api', api);
  app.use('/', api);
}
