// ============================================
// api.js — HTTP client for FastAPI backend
// ============================================

const API_BASE = '/api';

async function api(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    };

    // Add auth token if available
    const token = localStorage.getItem('ims_token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Something went wrong');
        }
        return data;
    } catch (err) {
        console.error(`API Error [${endpoint}]:`, err);
        throw err;
    }
}

// Convenience methods
const API = {
    get: (endpoint) => api(endpoint),
    post: (endpoint, body) => api(endpoint, { method: 'POST', body }),
    put: (endpoint, body) => api(endpoint, { method: 'PUT', body }),
    delete: (endpoint) => api(endpoint, { method: 'DELETE' }),
};
