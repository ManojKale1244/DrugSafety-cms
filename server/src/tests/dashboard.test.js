import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { config } from '../config/index.js';
import { seedDatabase } from '../seeds/seed.js';

describe('Module 2: Dashboard Summary Integration Tests', () => {
  let adminCookie;
  let reviewerCookie;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    await seedDatabase();

    // Login Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@drugsafety.local', password: 'Admin@123456' });
    adminCookie = adminRes.headers['set-cookie'];

    // Login Reviewer (processor)
    const revRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reviewer@drugsafety.local', password: 'Reviewer@123456' });
    reviewerCookie = revRes.headers['set-cookie'];
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('unauthenticated request to /api/dashboard/summary returns 401', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('admin receives organization-wide metrics and workload for all reviewers', async () => {
    const start = Date.now();
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', adminCookie);
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isGlobalScope).toBe(true);
    expect(duration).toBeLessThan(1000); // Loads < 1s

    const { summary, casesByStatus, workloadPerUser, trend14d, recentActivity } = res.body;

    // Check summary numbers match seeded data
    expect(summary.totalCases).toBeGreaterThanOrEqual(12);
    expect(summary.awaitingMedicalReview).toBeGreaterThanOrEqual(3);
    expect(summary.overdueActions).toBeGreaterThanOrEqual(1);
    expect(summary.dueForReporting7d).toBeGreaterThanOrEqual(1);

    // Donut chart data
    expect(Array.isArray(casesByStatus)).toBe(true);
    expect(casesByStatus.length).toBe(6);

    // Workload per user
    expect(Array.isArray(workloadPerUser)).toBe(true);
    expect(workloadPerUser.length).toBeGreaterThan(1);

    // 14-day trend
    expect(Array.isArray(trend14d)).toBe(true);
    expect(trend14d.length).toBe(14);

    // Recent activity audit events
    expect(Array.isArray(recentActivity)).toBe(true);
  });

  it('processor (reviewer) only sees data scoped to their assigned workload', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Cookie', reviewerCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isGlobalScope).toBe(false);

    const { workloadPerUser, myTasks } = res.body;

    // A processor never sees other users' private workload
    expect(workloadPerUser.length).toBe(1);
    expect(workloadPerUser[0].email).toBe('reviewer@drugsafety.local');

    // My tasks should only belong to this reviewer
    expect(Array.isArray(myTasks)).toBe(true);
    for (const task of myTasks) {
      expect(task.isOverdue).toBeDefined();
      expect(task.urgency).toBeDefined();
    }
  });
});
