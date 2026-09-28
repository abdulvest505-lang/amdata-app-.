// ---- Config ----
const API_BASE = '/api';

// ---- Service worker registration (makes the app installable/offline-capable) ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(console.error);
  });
}

// ---- Auth helpers ----
const Auth = {
  getToken: () => localStorage.getItem('amdata_token'),
  setToken: (t) => localStorage.setItem('amdata_token', t),
  getUser: () => JSON.parse(localStorage.getItem('amdata_user') || 'null'),
  setUser: (u) => localStorage.setItem('amdata_user', JSON.stringify(u)),
  logout: () => {
    localStorage.removeItem('amdata_token');
    localStorage.removeItem('amdata_user');
    window.location.href = '/login.html';
  },
  requireLogin: () => {
    if (!Auth.getToken()) window.location.href = '/login.html';
  },
  requireAdmin: () => {
    const u = Auth.getUser();
    if (!Auth.getToken() || !u || u.role !== 'admin') window.location.href = '/login.html';
  },
};

// ---- API helper ----
async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && Auth.getToken()) headers.Authorization = `Bearer ${Auth.getToken()}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'An samu matsala, gwada kuma');
  return data;
}

function fmtNaira(n) {
  return '₦' + Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

function fmtDate(d) {
  return new Date(d).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}
