import axios from 'axios';

const TOKEN_KEY = 'erp_admin_token';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the admin session token to every request.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap { success, data, meta } responses and normalize errors.
client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status;
    // Expired/invalid session: clear it and send the user back to login.
    if (status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('erp_admin_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    const message =
      err.response?.data?.error ||
      (err.code === 'ERR_NETWORK'
        ? 'Cannot reach the server. Is the backend running?'
        : err.message || 'Something went wrong');
    const error = new Error(message);
    error.status = status;
    error.details = err.response?.data?.details;
    return Promise.reject(error);
  }
);

export default client;