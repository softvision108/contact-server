// Forked from skystake apps/main/backend/src/vendors/resend: one mail through Resend's HTTP API
// (the same call as the `resend` SDK's emails.send), with Node's own fetch instead of axios.
const RESEND_API = 'https://api.resend.com';
const TIMEOUT_MS = 10_000;

async function call(apiKey, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${RESEND_API}${path}`, {
    method,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(`Resend ${res.status}: ${data.message || data.error || res.statusText}`), { resendName: data.name });
  }
  return data;
}

/**
 * Sends one mail. Throws on a refusal (with Resend's own message), returns Resend's mail id.
 * `from` is "Name <address>", `to` is one address or a list; `text` is the plain message.
 */
export async function sendResendMail({ apiKey, from, to, subject, text, replyTo }) {
  const data = await call(apiKey, '/emails', {
    method: 'POST',
    body: { from, to: [].concat(to), subject, text, ...(replyTo ? { reply_to: replyTo } : {}) },
  });
  return { messageId: data.id ? String(data.id) : null };
}

/**
 * The account's domains, to check a key. A key with "sending access" only cannot list them:
 * that gives { restricted: true } instead of an error.
 */
export async function listResendDomains(apiKey) {
  try {
    const data = await call(apiKey, '/domains');
    return { restricted: false, domains: (data.data || []).map((d) => ({ name: d.name, status: d.status })) };
  } catch (err) {
    if (err.resendName === 'restricted_api_key') return { restricted: true, domains: [] };
    throw err;
  }
}
