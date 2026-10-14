import bcrypt from 'bcryptjs';

export const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  historyLimit: 5,
};

/**
 * Validates password format against complexity rules.
 *
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePasswordComplexity(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }
  if (PASSWORD_POLICY.requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if new password matches current password or any of the last N passwords in history.
 *
 * @param {string} plainPassword
 * @param {string} currentPasswordHash
 * @param {Array<{hash: string}>} [history=[]]
 * @returns {Promise<boolean>} True if password was previously used
 */
export async function isPasswordInHistory(plainPassword, currentPasswordHash, history = []) {
  if (currentPasswordHash) {
    const matchesCurrent = await bcrypt.compare(plainPassword, currentPasswordHash);
    if (matchesCurrent) return true;
  }

  if (!Array.isArray(history) || history.length === 0) {
    return false;
  }

  for (const item of history) {
    if (item?.hash) {
      const match = await bcrypt.compare(plainPassword, item.hash);
      if (match) return true;
    }
  }

  return false;
}
