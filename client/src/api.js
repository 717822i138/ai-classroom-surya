export const API = import.meta.env.VITE_API_URL || `http://${location.hostname}:3001`;
export const token = () => localStorage.getItem('sec_token') || '';
const kick = () => { localStorage.removeItem('sec_token'); localStorage.removeItem('sec_user'); location.reload(); };
async function call(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() } });
  if (r.status === 401 && !path.startsWith('/api/auth/')) kick();
  return r.json().catch(() => ({ error: 'Server error' }));
}
export const post = (path, body) => call(path, { method: 'POST', body: JSON.stringify(body) });
export const get = (path) => call(path);
