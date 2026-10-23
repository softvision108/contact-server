const TOKEN_KEY = "contact-server-token";

function storage(fn) {
  try {
    return fn(localStorage);
  } catch {
    return null;
  }
}

export const getToken = () => storage((s) => s.getItem(TOKEN_KEY));
export const setToken = (t) => storage((s) => (t ? s.setItem(TOKEN_KEY, t) : s.removeItem(TOKEN_KEY)));

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function queryString(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== "" && v !== null && v !== undefined) q.set(k, String(v));
  return q.toString();
}
