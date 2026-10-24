// Encrypts the mail API keys kept in MongoDB (AES-256-GCM, key from MAIL_SECRET).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from './config.js';

const KEY = createHash('sha256').update(config.mailSecret).digest();

export function encrypt(plain) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64'))).join(':');
}

export function decrypt(stored) {
  const [version, iv, tag, data] = String(stored).split(':');
  if (version !== 'v1') throw new Error('Unknown key format');
  try {
    const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Saved API key cannot be read (MAIL_SECRET changed?): enter the key again');
  }
}

// re_3rqEQ...eef -> re_3rq…eef
export const keyHint = (key) => (key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-3)}` : '…');
