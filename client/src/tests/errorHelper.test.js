import { describe, it, expect } from 'vitest';
import { formatErrorMessage } from '../utils/errorHelper';

describe('formatErrorMessage', () => {
  it('returns plain string as is', () => {
    expect(formatErrorMessage('Simple error')).toBe('Simple error');
  });

  it('safely extracts message from { code, message } object', () => {
    const errObj = { code: 'AUTH_FAILED', message: 'Invalid credentials provided' };
    expect(formatErrorMessage(errObj)).toBe('Invalid credentials provided');
  });

  it('safely extracts message from { error: { code, message } }', () => {
    const errObj = { error: { code: 'UNAUTHORIZED', message: 'Session expired' } };
    expect(formatErrorMessage(errObj)).toBe('Session expired');
  });

  it('safely extracts string from { error: "Some error" }', () => {
    const errObj = { error: 'Direct error string' };
    expect(formatErrorMessage(errObj)).toBe('Direct error string');
  });

  it('safely handles Axios error with response.data as { code, message }', () => {
    const axiosErr = {
      response: {
        data: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many login attempts',
        },
      },
    };
    expect(formatErrorMessage(axiosErr)).toBe('Too many login attempts');
  });

  it('safely handles Axios error with response.data.issues array', () => {
    const axiosErr = {
      response: {
        data: {
          issues: [{ message: 'Email required' }, { message: 'Password too short' }],
        },
      },
    };
    expect(formatErrorMessage(axiosErr)).toBe('Email required, Password too short');
  });

  it('falls back gracefully when error is null or undefined', () => {
    expect(formatErrorMessage(null, 'Custom fallback')).toBe('Custom fallback');
    expect(formatErrorMessage(undefined)).toBe('An unexpected error occurred. Please try again.');
  });
});
