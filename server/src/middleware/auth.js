import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../models/User.js';

export const AUTH_COOKIE_NAME = 'drug_safety_token';

/**
 * Cookie configuration options for JWT session.
 */
export const getCookieOptions = () => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.isProduction ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/',
});

/**
 * Middleware: Verify user authentication via httpOnly cookie or Authorization header.
 */
export async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.[AUTH_COOKIE_NAME] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in.',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      res.clearCookie(AUTH_COOKIE_NAME, getCookieOptions());
      return res.status(401).json({
        success: false,
        error: err.name === 'TokenExpiredError' ? 'Session expired. Please sign in again.' : 'Invalid session token',
      });
    }

    // Retrieve user and populate role permissions fresh from DB
    const user = await User.findById(decoded.id).populate('roleId');

    if (!user) {
      res.clearCookie(AUTH_COOKIE_NAME, getCookieOptions());
      return res.status(401).json({
        success: false,
        error: 'User account no longer exists',
      });
    }

    if (user.status !== 'active') {
      res.clearCookie(AUTH_COOKIE_NAME, getCookieOptions());
      return res.status(403).json({
        success: false,
        error: 'Account has been deactivated. Please contact an administrator.',
      });
    }

    if (user.isLocked) {
      return res.status(403).json({
        success: false,
        error: `Account is temporarily locked until ${user.lockUntil.toLocaleTimeString()}. Try again later or contact an administrator.`,
      });
    }

    // Attach user and role to request
    req.user = user;
    req.userRole = user.roleId;

    next();
  } catch {
    return res.status(500).json({
      success: false,
      error: 'Authentication failure',
    });
  }
}

/**
 * Middleware: Enforce specific role names.
 *
 * @param  {...string} allowedRoles
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.userRole) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const currentRoleName = req.userRole.name;
    if (currentRoleName === 'admin' || allowedRoles.includes(currentRoleName)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Access denied: your role does not have permission to access this resource',
    });
  };
}

/**
 * Middleware: Enforce permission codes (e.g. 'case.create', 'user.manage').
 * Permissions are loaded server-side from the user's Role document.
 *
 * @param  {...string} requiredPermissions
 */
export function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user || !req.userRole) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const role = req.userRole;
    const permissions = role.permissions || [];

    // Admin role has implicit full permissions, or wildcard '*'
    if (role.name === 'admin' || permissions.includes('*')) {
      return next();
    }

    const hasAll = requiredPermissions.every((perm) => permissions.includes(perm));
    if (hasAll) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Access denied: missing required permission [${requiredPermissions.join(', ')}]`,
    });
  };
}
