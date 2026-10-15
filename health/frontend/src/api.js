const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

let csrfToken = null;

export function setCsrfToken(token) {
    csrfToken = token;
}

class ApiError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

async function request(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const needsCsrf = method !== 'GET' && method !== 'HEAD';
    if (needsCsrf && csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }

    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        // kein JSON-Body (z.B. bei 204)
    }

    if (!res.ok) {
        throw new ApiError(res.status, data?.error || 'unknown_error', data?.message || `Fehler ${res.status}`);
    }

    return data;
}

export const api = {
    getCsrf: () => request('/api/csrf.php'),
    me: () => request('/api/auth/me.php'),
    register: (payload) => request('/api/auth/register.php', { method: 'POST', body: payload }),
    login: (payload) => request('/api/auth/login.php', { method: 'POST', body: payload }),
    logout: () => request('/api/auth/logout.php', { method: 'POST' }),

    getProfile: () => request('/api/profile.php'),
    updateProfile: (payload) => request('/api/profile.php', { method: 'PUT', body: payload }),
    giveHealthConsent: () => request('/api/account.php', { method: 'POST', body: { healthConsent: true } }),
    deleteAccount: (password) => request('/api/account.php', { method: 'DELETE', body: { password } }),

    listSessions: () => request('/api/sessions.php'),
    createSession: (payload) => request('/api/sessions.php', { method: 'POST', body: payload }),
    updateSession: (payload) => request('/api/sessions.php', { method: 'PUT', body: payload }),

    sendChat: (payload) => request('/api/chat.php', { method: 'POST', body: payload }),

    getSafetyPlan: () => request('/api/safety_plan.php'),
    saveSafetyPlan: (payload) => request('/api/safety_plan.php', { method: 'PUT', body: payload }),

    listCheckins: (days = 30) => request(`/api/checkins.php?days=${encodeURIComponent(days)}`),
    saveCheckin: (payload) => request('/api/checkins.php', { method: 'POST', body: payload }),

    listActivities: (date) => request(`/api/activities.php?date=${encodeURIComponent(date)}`),
    createActivity: (payload) => request('/api/activities.php', { method: 'POST', body: payload }),
    updateActivity: (payload) => request('/api/activities.php', { method: 'PUT', body: payload }),
    deleteActivity: (id) => request('/api/activities.php', { method: 'DELETE', body: { id } }),

    sendContact: (payload) => request('/api/contact.php', { method: 'POST', body: payload }),

    adminLogin: (pin) => request('/api/admin/login.php', { method: 'POST', body: { pin } }),
    adminLogout: () => request('/api/admin/logout.php', { method: 'POST' }),
    getAdminConfig: () => request('/api/admin/settings.php'),
    saveAdminConfig: (payload) => request('/api/admin/settings.php', { method: 'POST', body: payload }),
    listAdminUsers: () => request('/api/admin/users.php'),
    deleteAdminUser: (id) => request('/api/admin/users.php', { method: 'DELETE', body: { id } }),
};

export { ApiError };
