import crypto from 'crypto';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { LoginHistory } from '../models/LoginHistory.js';
import { hashPassword } from './auth.service.js';
import { recordAudit } from '../utils/audit.js';

/**
 * List users with search, role/status filtering, and pagination.
 */
export async function getUsers({
  search = '',
  status = '',
  roleId = '',
  page = 1,
  limit = 10,
}) {
  const query = {};

  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { name: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
    ];
  }

  if (status && ['active', 'inactive'].includes(status)) {
    query.status = status;
  }

  if (roleId) {
    query.roleId = roleId;
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (safePage - 1) * safeLimit;

  const [users, total] = await Promise.all([
    User.find(query)
      .populate('roleId', 'name displayName permissions')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit),
    User.countDocuments(query),
  ]);

  return {
    users,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

/**
 * Create a new user (Admin only, no public signup).
 */
export async function createUser(data, actor, req) {
  const email = data.email.toLowerCase().trim();

  const existing = await User.findOne({ email });
  if (existing) {
    return {
      success: false,
      statusCode: 400,
      error: 'A user with this email address already exists',
    };
  }

  const role = await Role.findById(data.roleId);
  if (!role) {
    return {
      success: false,
      statusCode: 400,
      error: 'Selected role does not exist',
    };
  }

  // Use provided password or generate an initial compliant password
  const rawPassword = data.password || `Init@${crypto.randomBytes(4).toString('hex')}!`;
  const passwordHash = await hashPassword(rawPassword);

  const newUser = await User.create({
    name: data.name.trim(),
    email,
    passwordHash,
    roleId: role._id,
    status: 'active',
    mustChangePassword: data.mustChangePassword !== false,
    failedAttempts: 0,
    lockUntil: null,
  });

  await recordAudit({
    actor,
    action: 'USER_CREATE',
    entity: 'User',
    entityId: newUser._id,
    summary: `Admin ${actor.email} created user ${newUser.email} with role ${role.name}`,
    details: {
      name: newUser.name,
      email: newUser.email,
      role: role.name,
    },
    req,
  });

  const populated = await User.findById(newUser._id).populate('roleId', 'name displayName permissions');

  return {
    success: true,
    user: populated,
    initialPassword: data.password ? undefined : rawPassword,
  };
}

/**
 * Get user by ID.
 */
export async function getUserById(id) {
  return User.findById(id).populate('roleId', 'name displayName permissions');
}

/**
 * Update user information (Admin only).
 */
export async function updateUser(id, updateData, actor, req) {
  const user = await User.findById(id).populate('roleId');
  if (!user) {
    return { success: false, statusCode: 404, error: 'User not found' };
  }

  const before = {
    name: user.name,
    email: user.email,
    roleId: user.roleId?._id?.toString(),
    roleName: user.roleId?.name,
    status: user.status,
  };

  if (updateData.name) user.name = updateData.name.trim();

  if (updateData.email && updateData.email.toLowerCase().trim() !== user.email) {
    const emailCandidate = updateData.email.toLowerCase().trim();
    const existing = await User.findOne({ email: emailCandidate, _id: { $ne: user._id } });
    if (existing) {
      return { success: false, statusCode: 400, error: 'Email is already taken by another account' };
    }
    user.email = emailCandidate;
  }

  let roleChanged = false;
  if (updateData.roleId && updateData.roleId !== user.roleId?._id?.toString()) {
    const newRole = await Role.findById(updateData.roleId);
    if (!newRole) {
      return { success: false, statusCode: 400, error: 'Selected role not found' };
    }
    user.roleId = newRole._id;
    roleChanged = true;
  }

  if (updateData.mustChangePassword !== undefined) {
    user.mustChangePassword = updateData.mustChangePassword;
  }

  await user.save();

  const after = {
    name: user.name,
    email: user.email,
    roleId: user.roleId.toString(),
    status: user.status,
  };

  await recordAudit({
    actor,
    action: roleChanged ? 'USER_ROLE_CHANGE' : 'USER_UPDATE',
    entity: 'User',
    entityId: user._id,
    summary: roleChanged
      ? `User ${user.email} role changed by admin ${actor.email}`
      : `User ${user.email} updated by admin ${actor.email}`,
    details: { before, after },
    req,
  });

  const updated = await User.findById(user._id).populate('roleId', 'name displayName permissions');
  return { success: true, user: updated };
}

/**
 * Update status of single user (Activate/Deactivate).
 */
export async function updateUserStatus(id, newStatus, actor, req) {
  const user = await User.findById(id);
  if (!user) {
    return { success: false, statusCode: 404, error: 'User not found' };
  }

  // Prevent self-deactivation by admin
  if (user._id.toString() === actor._id.toString() && newStatus === 'inactive') {
    return {
      success: false,
      statusCode: 400,
      error: 'You cannot deactivate your own administrative account.',
    };
  }

  const oldStatus = user.status;
  user.status = newStatus;
  if (newStatus === 'active') {
    // Also reset any lockouts
    user.failedAttempts = 0;
    user.lockUntil = null;
  }
  await user.save();

  await recordAudit({
    actor,
    action: 'USER_STATUS_CHANGE',
    entity: 'User',
    entityId: user._id,
    summary: `User ${user.email} status changed from ${oldStatus} to ${newStatus} by ${actor.email}`,
    details: { oldStatus, newStatus },
    req,
  });

  return { success: true, user };
}

/**
 * Bulk update status for multiple users (Bulk Deactivate/Activate).
 */
export async function bulkUpdateStatus(userIds, newStatus, actor, req) {
  const currentAdminId = actor._id.toString();
  // Filter out the current admin from deactivation
  const targetIds = userIds.filter((id) => id !== currentAdminId);

  const users = await User.find({ _id: { $in: targetIds } });

  const updatedCount = users.length;
  await User.updateMany(
    { _id: { $in: targetIds } },
    {
      $set: {
        status: newStatus,
        ...(newStatus === 'active' ? { failedAttempts: 0, lockUntil: null } : {}),
      },
    },
  );

  for (const u of users) {
    await recordAudit({
      actor,
      action: 'USER_STATUS_CHANGE_BULK',
      entity: 'User',
      entityId: u._id,
      summary: `Bulk status update: ${u.email} marked as ${newStatus} by ${actor.email}`,
      details: { newStatus },
      req,
    });
  }

  return {
    success: true,
    affectedCount: updatedCount,
    skippedSelf: userIds.includes(currentAdminId) && newStatus === 'inactive',
  };
}

/**
 * Get login history for a specific user.
 */
export async function getUserLoginHistory(userId, { page = 1, limit = 20 }) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const [history, total] = await Promise.all([
    LoginHistory.find({ userId })
      .sort({ at: -1 })
      .skip(skip)
      .limit(safeLimit),
    LoginHistory.countDocuments({ userId }),
  ]);

  return {
    history,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}
