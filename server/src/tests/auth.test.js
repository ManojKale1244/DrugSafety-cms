import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import { config } from '../config/index.js';
import { seedDatabase } from '../seeds/seed.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';

describe('Module 1: Authentication & RBAC Integration Tests', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    await seedDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('POST /api/auth/login', () => {
    it('successfully logs in with valid credentials and sets httpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@drugsafety.local',
          password: 'Admin@123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('admin@drugsafety.local');
      expect(res.body.user.role.name).toBe('admin');

      // Verify cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('drug_safety_token='))).toBe(true);
      expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
    });

    it('inactive users cannot log in (returns 403)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'inactive@drugsafety.local',
          password: 'Inactive@123456',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/deactivated/i);
    });

    it('lockout works: 5 failed attempts locks the account', async () => {
      // Create a fresh test user
      const reviewerRole = await Role.findOne({ name: 'reviewer' });
      const testEmail = 'lockout-test@drugsafety.local';
      await User.deleteOne({ email: testEmail });

      const bcrypt = (await import('bcryptjs')).default;
      const passwordHash = await bcrypt.hash('TestPass@123', 10);
      await User.create({
        name: 'Lockout Test',
        email: testEmail,
        passwordHash,
        roleId: reviewerRole._id,
        status: 'active',
        failedAttempts: 0,
      });

      // Fail 4 times
      for (let i = 1; i <= 4; i++) {
        const failRes = await request(app)
          .post('/api/auth/login')
          .send({ email: testEmail, password: 'WrongPassword!123' });

        expect(failRes.status).toBe(401);
        expect(failRes.body.error).toContain('remaining');
      }

      // 5th failure -> triggers lockout
      const fifthRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'WrongPassword!123' });

      expect(fifthRes.status).toBe(403);
      expect(fifthRes.body.isLocked).toBe(true);
      expect(fifthRes.body.error).toMatch(/Account locked/i);

      // Even with correct password, login is blocked while locked
      const blockedRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'TestPass@123' });

      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.isLocked).toBe(true);
      expect(blockedRes.body.error).toMatch(/temporarily locked/i);
    });

    it('returns 401 safe generic error for non-existent users', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@drugsafety.local',
          password: 'SomePassword@123',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
  });

  describe('RBAC & Role from client is ignored', () => {
    let reviewerCookie;
    let adminCookie;

    beforeAll(async () => {
      // Login reviewer
      const revRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'reviewer@drugsafety.local', password: 'Reviewer@123456' });
      reviewerCookie = revRes.headers['set-cookie'];

      // Login admin
      const admRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@drugsafety.local', password: 'Admin@123456' });
      adminCookie = admRes.headers['set-cookie'];
    });

    it('unauthorized access returns 403 when non-admin accesses admin-only route', async () => {
      // Reviewer tries to access GET /api/users
      const res = await request(app)
        .get('/api/users')
        .set('Cookie', reviewerCookie);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Access denied/i);
    });

    it('unauthenticated request returns 401', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('admin can access /api/users successfully', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('role from client is ignored during operations', async () => {
      // Even if a client injects a role field in request headers or body,
      // server strictly extracts role and permissions from DB
      const res = await request(app)
        .get('/api/users')
        .set('Cookie', reviewerCookie)
        .set('x-role', 'admin') // Fake header
        .send({ role: 'admin' });

      // Must still be 403
      expect(res.status).toBe(403);
    });
  });
});
