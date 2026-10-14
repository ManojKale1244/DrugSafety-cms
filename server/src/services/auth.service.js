import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../models/User.js';
import { LoginHistory } from '../models/LoginHistory.js';
import { recordAudit } from '../utils/audit.js';
import { isPasswordInHistory, validatePasswordComplexity } from '../utils/passwordPolicy.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/**
 * Hash a plain string password using bcrypt.
 *
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/**
 * Generate a JWT token for the user.
 *
 * @param {import('../models/User.js').User} user
 * @returns {string}
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
    },
  );
}

/**
 * Authenticate user credentials, handle lockouts and login history.
 *
 * @param {Object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @param {import('express').Request} req
 */
export async function authenticateUser({ email, password }, req) {
  const normalizedEmail = email.toLowerCase().trim();
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  const user = await User.findOne({ email: normalizedEmail })
    .select('+passwordHash +passwordHistory')
    .populate('roleId');

  // If user does not exist, return generic error (do not leak existence)
  if (!user) {
    await LoginHistory.create({
      userId: null,
      emailAttempted: normalizedEmail,
      ip,
      userAgent,
      success: false,
      reason: 'user_not_found',
      at: new Date(),
    });

    return {
      success: false,
      statusCode: 401,
      error: 'Invalid email or password',
    };
  }

  // Check if account is locked
  if (user.lockUntil && user.lockUntil > Date.now()) {
    const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / (60 * 1000));
    await LoginHistory.create({
      userId: user._id,
      emailAttempted: normalizedEmail,
      ip,
      userAgent,
      success: false,
      reason: 'account_locked',
      at: new Date(),
    });

    return {
      success: false,
      statusCode: 403,
      isLocked: true,
      error: `Account is temporarily locked due to excessive failed attempts. Try again in ${minutesLeft} minute(s).`,
    };
  }

  // Check if account is deactivated
  if (user.status !== 'active') {
    await LoginHistory.create({
      userId: user._id,
      emailAttempted: normalizedEmail,
      ip,
      userAgent,
      success: false,
      reason: 'inactive_account',
      at: new Date(),
    });

    return {
      success: false,
      statusCode: 403,
      error: 'Account has been deactivated. Please contact an administrator.',
    };
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    user.failedAttempts = (user.failedAttempts || 0) + 1;
    let lockOccurred = false;

    if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      lockOccurred = true;

      await recordAudit({
        actor: user,
        action: 'AUTH_ACCOUNT_LOCKED',
        entity: 'User',
        entityId: user._id,
        summary: `Account for ${user.email} locked for ${LOCKOUT_MINUTES} minutes after ${user.failedAttempts} failed login attempts`,
        req,
      });
    }

    await user.save();

    await LoginHistory.create({
      userId: user._id,
      emailAttempted: normalizedEmail,
      ip,
      userAgent,
      success: false,
      reason: lockOccurred ? 'lockout_triggered' : 'invalid_password',
      at: new Date(),
    });

    if (lockOccurred) {
      return {
        success: false,
        statusCode: 403,
        isLocked: true,
        error: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Please wait ${LOCKOUT_MINUTES} minutes or contact an admin.`,
      };
    }

    const remaining = MAX_FAILED_ATTEMPTS - user.failedAttempts;
    return {
      success: false,
      statusCode: 401,
      error: `Invalid email or password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before temporary lockout)`,
    };
  }

  // Password matched: reset counters
  user.failedAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  await LoginHistory.create({
    userId: user._id,
    emailAttempted: normalizedEmail,
    ip,
    userAgent,
    success: true,
    at: new Date(),
  });

  await recordAudit({
    actor: user,
    action: 'AUTH_LOGIN_SUCCESS',
    entity: 'User',
    entityId: user._id,
    summary: `User ${user.email} logged in successfully`,
    req,
  });

  const token = generateToken(user);

  return {
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      role: {
        id: user.roleId?._id,
        name: user.roleId?.name,
        displayName: user.roleId?.displayName,
        permissions: user.roleId?.permissions || [],
      },
    },
  };
}

/**
 * Handle password change for an authenticated user.
 */
export async function changePassword({ userId, currentPassword, newPassword }, req) {
  const user = await User.findById(userId).select('+passwordHash +passwordHistory').populate('roleId');
  if (!user) {
    return { success: false, statusCode: 404, error: 'User not found' };
  }

  // Verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return { success: false, statusCode: 400, error: 'Incorrect current password' };
  }

  // Validate complexity
  const complexity = validatePasswordComplexity(newPassword);
  if (!complexity.valid) {
    return { success: false, statusCode: 400, error: complexity.errors.join('. ') };
  }

  // Check history (cannot reuse current or last 5)
  const isReused = await isPasswordInHistory(newPassword, user.passwordHash, user.passwordHistory);
  if (isReused) {
    return {
      success: false,
      statusCode: 400,
      error: 'Cannot reuse recent passwords. Please choose a password not used in your last 5 changes.',
    };
  }

  // Archive old hash to history (limit to 5)
  user.passwordHistory = user.passwordHistory || [];
  user.passwordHistory.unshift({ hash: user.passwordHash, changedAt: new Date() });
  if (user.passwordHistory.length > 5) {
    user.passwordHistory = user.passwordHistory.slice(0, 5);
  }

  // Hash new password
  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  await recordAudit({
    actor: user,
    action: 'AUTH_PASSWORD_CHANGE',
    entity: 'User',
    entityId: user._id,
    summary: `Password changed for user ${user.email}`,
    req,
  });

  return { success: true, message: 'Password updated successfully' };
}

/**
 * Initiate forgot password flow by creating a reset token.
 */
export async function requestPasswordReset(email, req) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user || user.status !== 'active') {
    // Return success to prevent enumeration
    return {
      success: true,
      message: 'If an active account exists with that email address, a password reset instruction has been logged.',
    };
  }

  // Generate a cryptographically strong reset token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  await recordAudit({
    actor: user,
    action: 'AUTH_RESET_TOKEN_GENERATED',
    entity: 'User',
    entityId: user._id,
    summary: `Password reset token requested for ${user.email}`,
    req,
  });

  return {
    success: true,
    message: 'If an active account exists with that email address, a password reset instruction has been generated.',
    // For educational/dev testing visibility:
    devResetToken: config.isProduction ? undefined : rawToken,
  };
}

/**
 * Reset password using a valid reset token.
 */
export async function resetPasswordWithToken({ token, newPassword }, req) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  })
    .select('+passwordHash +passwordHistory')
    .populate('roleId');

  if (!user) {
    return {
      success: false,
      statusCode: 400,
      error: 'Password reset token is invalid or has expired.',
    };
  }

  // Check complexity
  const complexity = validatePasswordComplexity(newPassword);
  if (!complexity.valid) {
    return { success: false, statusCode: 400, error: complexity.errors.join('. ') };
  }

  // Check history
  const isReused = await isPasswordInHistory(newPassword, user.passwordHash, user.passwordHistory);
  if (isReused) {
    return {
      success: false,
      statusCode: 400,
      error: 'Cannot reuse recent passwords. Please choose a password not used in your last 5 changes.',
    };
  }

  // Archive old hash
  user.passwordHistory = user.passwordHistory || [];
  user.passwordHistory.unshift({ hash: user.passwordHash, changedAt: new Date() });
  if (user.passwordHistory.length > 5) {
    user.passwordHistory = user.passwordHistory.slice(0, 5);
  }

  user.passwordHash = await hashPassword(newPassword);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.failedAttempts = 0;
  user.lockUntil = null;
  user.mustChangePassword = false;
  await user.save();

  await recordAudit({
    actor: user,
    action: 'AUTH_PASSWORD_RESET_COMPLETE',
    entity: 'User',
    entityId: user._id,
    summary: `Password reset completed for ${user.email}`,
    req,
  });

  return { success: true, message: 'Password has been reset successfully. You may now sign in.' };
}
