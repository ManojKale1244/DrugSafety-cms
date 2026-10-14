import {
  getUsers,
  createUser,
  getUserById,
  updateUser,
  updateUserStatus,
  bulkUpdateStatus,
  getUserLoginHistory,
} from '../services/user.service.js';
import { Role } from '../models/Role.js';

export async function listUsers(req, res, next) {
  try {
    const { search, status, roleId, page, limit } = req.query;
    const result = await getUsers({ search, status, roleId, page, limit });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function createNewUser(req, res, next) {
  try {
    const result = await createUser(req.body, req.user, req);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: result.user,
      initialPassword: result.initialPassword,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUser(req, res, next) {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    return res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
}

export async function updateUserDetails(req, res, next) {
  try {
    const result = await updateUser(req.params.id, req.body, req.user, req);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
      });
    }
    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

export async function changeUserStatus(req, res, next) {
  try {
    const result = await updateUserStatus(req.params.id, req.body.status, req.user, req);
    if (!result.success) {
      return res.status(result.statusCode || 400).json({
        success: false,
        error: result.error,
      });
    }
    return res.status(200).json({
      success: true,
      message: `User status changed to ${req.body.status}`,
      user: result.user,
    });
  } catch (error) {
    next(error);
  }
}

export async function bulkChangeStatus(req, res, next) {
  try {
    const { userIds, status } = req.body;
    const result = await bulkUpdateStatus(userIds, status, req.user, req);
    return res.status(200).json({
      success: true,
      message: `${result.affectedCount} user(s) status updated to ${status}${result.skippedSelf ? ' (your own account was protected)' : ''}`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLoginHistory(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = await getUserLoginHistory(req.params.id, { page, limit });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function getRolesList(req, res, next) {
  try {
    const roles = await Role.find().sort({ name: 1 });
    return res.status(200).json({ success: true, roles });
  } catch (error) {
    next(error);
  }
}
