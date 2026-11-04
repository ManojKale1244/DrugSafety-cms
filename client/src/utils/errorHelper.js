/**
 * Universal error formatter for safe rendering in React JSX.
 * Guarantees that the returned value is ALWAYS a primitive string,
 * preventing 'Objects are not valid as a React child (found: object with keys {code, message})' crashes.
 *
 * @param {any} err - The caught error or error payload
 * @param {string} [fallback='An unexpected error occurred. Please try again.']
 * @returns {string} Safe human-readable error string
 */
export function formatErrorMessage(err, fallback = 'An unexpected error occurred. Please try again.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  // Handle Axios response structure
  const data = err.response?.data !== undefined ? err.response.data : err;

  if (typeof data === 'string') return data;

  if (typeof data === 'object' && data !== null) {
    // 1. data.error as string
    if (typeof data.error === 'string') {
      return data.error;
    }
    // 2. data.error as object { code, message }
    if (typeof data.error === 'object' && data.error !== null) {
      if (typeof data.error.message === 'string') return data.error.message;
      if (typeof data.error.code === 'string') return `${data.error.code}: ${data.error.message || 'Request failed'}`;
    }
    // 3. data.message as string
    if (typeof data.message === 'string') {
      return data.message;
    }
    // 4. Zod issues array
    if (Array.isArray(data.issues) && data.issues.length > 0) {
      return data.issues.map((i) => i.message || i).join(', ');
    }
    // 5. Direct { code, message } on data
    if (typeof data.code !== 'undefined' && typeof data.message === 'string') {
      return data.message;
    }
    if (typeof data.statusText === 'string') {
      return data.statusText;
    }
  }

  // Handle standard JavaScript Error instance
  if (typeof err.message === 'string') {
    return err.message;
  }

  return fallback;
}

