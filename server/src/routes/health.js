import { Router } from 'express';

const router = Router();

/**
 * GET /api/health
 * Simple liveness / readiness probe.
 */
router.get('/', (_req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
