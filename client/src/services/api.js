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

/**
 * Appointment API
 */
export const appointment = {
  create: (data) => apiCall('/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getById: (id) => apiCall(`/appointments/${id}`),

  updateStatus: (id, status) => apiCall(`/appointments/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),

  cancel: (id, reason) => apiCall(`/appointments/${id}/cancel`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  }),

  reschedule: (id, data) => apiCall(`/appointments/${id}/reschedule`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  getAvailableSlots: (therapistId, date) => {
    const params = date ? `?date=${date}` : '';
    return apiCall(`/appointments/slots/${therapistId}${params}`);
  },

  createSessionReport: (id, data) => apiCall(`/appointments/${id}/report`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getSessionReport: (id) => apiCall(`/appointments/${id}/report`),
};

/**
 * Patient API
 */
export const patient = {
  getProfile: () => apiCall('/patients/profile'),

  updateProfile: (data) => apiCall('/patients/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  submitQuestionnaire: (data) => apiCall('/patients/questionnaire', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getQuestionnaireOptions: () => apiCall('/patients/questionnaire-options'),

  getMatchedTherapists: () => apiCall('/patients/matched-therapists'),

  selectTherapist: (therapistId) => apiCall('/patients/select-therapist', {
    method: 'POST',
    body: JSON.stringify({ therapistId }),
  }),

  getAppointments: () => apiCall('/patients/appointments'),

  getSessionReports: () => apiCall('/patients/session-reports'),
};

/**
 * Notifications API
 * Used by the patient dashboard to display refus / cancellation /
 * confirmation notifications emitted by the appointment controller.
 */
export const notification = {
  /**
   * Get the current user's notifications (paginated).
   * @param {{ page?: number, limit?: number }} params
   */
  getAll: (params) => {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return apiCall(`/notifications${query}`);
  },

  /**
   * Get the number of unread notifications for the badge.
   */
  getUnreadCount: () => apiCall('/notifications/unread-count'),

  /**
   * Mark a single notification as read.
   * @param {string} id
   */
  markAsRead: (id) => apiCall(`/notifications/${id}/read`, { method: 'PUT' }),

  /**
   * Mark every notification as read.
   */
  markAllAsRead: () => apiCall('/notifications/read-all', { method: 'PUT' }),

  /**
   * Delete a notification.
   * @param {string} id
   */
  delete: (id) => apiCall(`/notifications/${id}`, { method: 'DELETE' }),
};

/**
 * Therapist API
 */
export const therapistApi = {
  getProfile: () => apiCall('/therapists/profile'),

  updateProfile: (data) => apiCall('/therapists/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  getAvailability: (params) => {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return apiCall(`/therapists/availability${query}`);
  },

  createTimeSlots: (slots) => apiCall('/therapists/availability', {
    method: 'POST',
    body: JSON.stringify({ slots }),
  }),

  updateTimeSlot: (slotId, data) => apiCall(`/therapists/availability/${slotId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  deleteTimeSlot: (slotId) => apiCall(`/therapists/availability/${slotId}`, {
    method: 'DELETE',
  }),

  getPatients: () => apiCall('/therapists/patients'),

  getAppointments: (params) => {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return apiCall(`/therapists/appointments${query}`);
  },

  getReviews: () => apiCall('/therapists/reviews'),

  getStats: () => apiCall('/therapists/stats'),

  uploadDocuments: (formData) => apiUpload('/therapists/documents', formData),

  updateAppointmentStatus: (id, status) => apiCall(`/appointments/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),
};

/**
 * Public endpoints (no auth required)
 */
export const publicApi = {
  getTherapists: (params) => {
    const query = params ? `?${new URLSearchParams(params)}` : '';
    return apiCall(`/therapists/public${query}`);
  },

  getTherapistProfile: (id) => apiCall(`/therapists/public/${id}`),
};

export { getToken, setToken, removeToken, UNAUTHORIZED_EVENT };