import axios from 'axios';

/**
 * Pre-configured Axios instance.
 * - baseURL points to /api so Vite proxy handles dev routing.
 * - withCredentials sends the httpOnly JWT cookie automatically.
 * - Response interceptor handles 401 gracefully.
 */
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let sessionExpiredCallback = null;

export function registerSessionExpiredHandler(cb) {
  sessionExpiredCallback = cb;
}

// ── Response interceptor — handle 401 globally ──────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthMe = error.config?.url?.includes('/auth/me');
    const isLogin = error.config?.url?.includes('/auth/login');

    if (error.response?.status === 401 && !isAuthMe && !isLogin) {
      if (sessionExpiredCallback) {
        sessionExpiredCallback();
      } else if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
