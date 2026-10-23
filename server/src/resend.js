// Forked from skystake apps/main/backend/src/vendors/resend: one mail through Resend's HTTP API
// (the same call as the `resend` SDK's emails.send), with Node's own fetch instead of axios.
import { config } from './config.js';

const RESEND_API = 'https://api.resend.com';
const SEND_TIMEOUT_MS = 10_000;
const DEFAULT_FROM = 'Contacts <onboarding@resend.dev>';

const { mail } = config;

/** True when Resend has a key; the sender falls back to Resend's test address. */
export const isResendConfigured = () => Boolean(mail.resendKey);

export const resendFrom = () => mail.from || DEFAULT_FROM;

/**
 * Sends one mail. Throws on a refusal (with Resend's own message), returns Resend's mail id.
 * `to` is one address or a list; `text` is the plain message.
 */
export async function sendResendMail({ to, subject, text, replyTo }) {
  if (!isResendConfigured()) throw new Error('Email delivery is not configured (RESEND_API_KEY)');
  const res = await fetch(`${RESEND_API}/emails`, {
    method: 'POST',
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${mail.resendKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: resendFrom(),
      to: [].concat(to),
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${data.message || data.error || res.statusText}`);
  return { messageId: data.id ? String(data.id) : null };
}
