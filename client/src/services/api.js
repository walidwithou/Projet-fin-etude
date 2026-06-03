const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('token');
const setToken = (token) => localStorage.setItem('token', token);
const removeToken = () => localStorage.removeItem('token');

/**
 * Dispatched whenever a backend call returns 401 Unauthorized.
 * AuthContext listens for this and clears the local session,
 * which causes the React tree to redirect to the LOGIN page.
 */
const UNAUTHORIZED_EVENT = 'tassarut:unauthorized';

const emitUnauthorized = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
};

const getAuthHeaders = (isFormData = false) => {
  const token = getToken();
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  const isFormData = options.body instanceof FormData;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(isFormData),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Token is missing, expired, or otherwise invalid.
    // Drop the local copy and let AuthContext redirect to LOGIN.
    removeToken();
    emitUnauthorized();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `API Error: ${response.status}` }));
    const err = new Error(error.message || `API Error: ${response.status}`);
    err.status = response.status;
    throw err;
  }

  return response.json();
};

const apiUpload = async (endpoint, formData) => {
  return apiCall(endpoint, {
    method: 'POST',
    body: formData,
  });
};

export const auth = {
  register: (data) => apiCall('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  login: (email, password) => apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),

  logout: () => apiCall('/auth/logout', {
    method: 'POST',
  }),

  getCurrentUser: () => apiCall('/auth/me', {
    method: 'GET',
  }),

  forgotPassword: (email) => apiCall('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),

  resetPassword: (token, password) => apiCall('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  }),

  verifyEmail: (token) => apiCall('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }),
};

export const therapist = {
  uploadDocuments: (formData) => apiUpload('/therapists/documents', formData),
};

export { getToken, setToken, removeToken, UNAUTHORIZED_EVENT };
