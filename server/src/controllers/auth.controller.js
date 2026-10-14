import {
  authenticateUser,
  changePassword,
  requestPasswordReset,
  resetPasswordWithToken,
} from '../services/auth.service.js';
import { AUTH_COOKIE_NAME, getCookieOptions } from '../middleware/auth.js';
import { recordAudit } from '../utils/audit.js';

export async function login(req, res, next) {
  try {
    const result = await authenticateUser(req.body, req);

    if (!result.success) {
      return res.status(result.statusCode || 401).json({
        success: false,
        error: result.error,
        isLocked: !!result.isLocked,
      });
    }

    // Set JWT in httpOnly secure cookie
    res.cookie(AUTH_COOKIE_NAME, result.token, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully',
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    if (req.user) {
      await recordAudit({
        actor: req.user,
        action: 'AUTH_LOGOUT',
        entity: 'User',
        entityId: req.user._id,
        summary: `User ${req.user.email} signed out`,
        req,
      });
    }

    res.clearCookie(AUTH_COOKIE_NAME, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Signed out successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res) {
  const user = req.user;
  const role = req.userRole;

  return res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      role: {
        id: role?._id,
        name: role?.name,
        displayName: role?.displayName,
        permissions: role?.permissions || [],
      },
    },
  });
}

export async function forgotPassword(req, res, next) {
  try {
    const result = await requestPasswordReset(req.body.email, req);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const result = await resetPasswordWithToken(
      {
        token: req.body.token,
        newPassword: req.body.password,
      },
      req,
    );

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function changeUserPassword(req, res, next) {
  try {
    const result = await changePassword(
      {
        userId: req.user._id,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
      },
      req,
    );

    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
