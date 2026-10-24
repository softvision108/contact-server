// Resend accounts (integrations) and their From addresses (senders), set in Settings > Mail.
import { Router } from 'express';
import mongoose from 'mongoose';
import { config } from './config.js';
import { MailDay, MailIntegration, MailSender, Setting } from './models.js';
import { listResendDomains } from './resend.js';
import { decrypt, encrypt, keyHint } from './secret.js';

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

// "Lin Chung <support@itstaff.io>", or just the address when there is no name.
export const fromLine = (sender) => (sender.name ? `${sender.name.replace(/[<>"]/g, '')} <${sender.email}>` : sender.email);

function parseFrom(from) {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: '', email: from.trim() };
}

async function findOr404(model, id, what) {
  const doc = mongoose.isValidObjectId(id) ? await model.findById(id) : null;
  if (!doc) throw httpError(404, `${what} not found`);
  return doc;
}

const integrationJson = (i) => ({
  id: String(i._id), name: i.name, provider: i.provider, apiKeyHint: i.apiKeyHint, enabled: i.enabled,
});
const senderJson = (s) => ({
  id: String(s._id), integration: String(s.integration), name: s.name, email: s.email,
  from: fromLine(s), replyTo: s.replyTo, enabled: s.enabled,
});

/** Both lists, for the settings page and the send window (mail.js adds today's counts). */
export async function listAccounts() {
  const [integrations, senders] = await Promise.all([
    MailIntegration.find().sort({ createdAt: 1 }).lean(),
    MailSender.find().sort({ createdAt: 1 }).lean(),
  ]);
  return { integrations: integrations.map(integrationJson), senders: senders.map(senderJson) };
}

/** A sender that can send now, with its integration and the readable API key. */
export async function loadSender(id) {
  const sender = mongoose.isValidObjectId(id) ? await MailSender.findById(id).lean() : null;
  if (!sender) throw httpError(400, 'Choose a sender');
  const integration = await MailIntegration.findById(sender.integration).lean();
  if (!integration) throw httpError(400, 'The sender has no Resend account');
  if (!sender.enabled) throw httpError(400, `The sender ${fromLine(sender)} is turned off`);
  if (!integration.enabled) throw httpError(400, `The Resend account ${integration.name} is turned off`);
  let apiKey;
  try {
    apiKey = decrypt(integration.apiKeyEnc);
  } catch (err) {
    throw httpError(400, err.message);
  }
  return { sender, integration, apiKey };
}

function readIntegration(body, { isNew }) {
  const name = String(body?.name || '').trim();
  const apiKey = String(body?.apiKey || '').trim();
  if (!name) throw httpError(400, 'Name is required');
  if (isNew && !apiKey) throw httpError(400, 'API key is required');
  if (apiKey && !apiKey.startsWith('re_')) throw httpError(400, 'A Resend API key starts with re_');
  const out = { name };
  if (apiKey) Object.assign(out, { apiKeyEnc: encrypt(apiKey), apiKeyHint: keyHint(apiKey) });
  if (body?.enabled !== undefined) out.enabled = Boolean(body.enabled);
  return out;
}

async function readSender(body) {
  const email = String(body?.email || '').trim().toLowerCase();
  const replyTo = String(body?.replyTo || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw httpError(400, 'Enter a valid From address');
  if (replyTo && !EMAIL_RE.test(replyTo)) throw httpError(400, 'Enter a valid reply-to address, or leave it empty');
  await findOr404(MailIntegration, body?.integration, 'Resend account');
  const out = { integration: body.integration, name: String(body?.name || '').trim(), email, replyTo };
  if (body?.enabled !== undefined) out.enabled = Boolean(body.enabled);
  return out;
}

export const accountsRouter = Router();

accountsRouter.post('/integrations', wrap(async (req, res) => {
  const doc = await MailIntegration.create(readIntegration(req.body, { isNew: true }));
  res.status(201).json(integrationJson(doc));
}));

// An empty apiKey keeps the saved one.
accountsRouter.put('/integrations/:id', wrap(async (req, res) => {
  const doc = await findOr404(MailIntegration, req.params.id, 'Resend account');
  doc.set(readIntegration(req.body, { isNew: false }));
  await doc.save();
  res.json(integrationJson(doc));
}));

accountsRouter.delete('/integrations/:id', wrap(async (req, res) => {
  const doc = await findOr404(MailIntegration, req.params.id, 'Resend account');
  if (await MailSender.exists({ integration: doc._id })) throw httpError(409, 'Delete its senders first, or turn the account off');
  await doc.deleteOne();
  res.json({ ok: true });
}));

// Checks the key and whether each sender's domain is verified in this account.
accountsRouter.post('/integrations/:id/test', wrap(async (req, res) => {
  const doc = await findOr404(MailIntegration, req.params.id, 'Resend account');
  let result;
  try {
    result = await listResendDomains(decrypt(doc.apiKeyEnc));
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
  const senders = await MailSender.find({ integration: doc._id }).lean();
  const checks = senders.map((s) => {
    const domain = s.email.split('@')[1];
    const found = result.domains.find((d) => d.name === domain);
    return { id: String(s._id), from: fromLine(s), domain, status: result.restricted ? 'unknown' : found?.status || 'missing' };
  });
  res.json({ ok: true, restricted: result.restricted, domains: result.domains, senders: checks });
}));

accountsRouter.post('/senders', wrap(async (req, res) => {
  const doc = await MailSender.create(await readSender(req.body));
  res.status(201).json(senderJson(doc));
}));

accountsRouter.put('/senders/:id', wrap(async (req, res) => {
  const doc = await findOr404(MailSender, req.params.id, 'Sender');
  doc.set(await readSender(req.body));
  await doc.save();
  res.json(senderJson(doc));
}));

accountsRouter.delete('/senders/:id', wrap(async (req, res) => {
  const doc = await findOr404(MailSender, req.params.id, 'Sender');
  await doc.deleteOne();
  res.json({ ok: true });
}));

/**
 * Once, at startup: the Resend key and sender that used to live in .env become the first
 * integration and sender, and the old one-counter-per-day rows move to that sender.
 */
export async function migrateLegacyMail() {
  const { legacy } = config.mail;
  const oldDays = await MailDay.collection.find({ scope: { $exists: false } }).toArray();
  let sender = null;
  if (legacy.resendKey && !(await MailIntegration.exists({}))) {
    const integration = await MailIntegration.create({ name: 'Resend 1', apiKeyEnc: encrypt(legacy.resendKey), apiKeyHint: keyHint(legacy.resendKey) });
    const { name, email } = parseFrom(legacy.from || 'Lin Chung <support@itstaff.io>');
    sender = await MailSender.create({ integration: integration._id, name, email, replyTo: legacy.replyTo });
    if (legacy.delayMs !== null) await Setting.updateOne({ key: 'mail' }, { $setOnInsert: { delayMs: legacy.delayMs } }, { upsert: true });
    console.log(`Mail: created Resend account "Resend 1" with sender ${fromLine(sender)} from .env (RESEND_* can be removed now)`);
  }
  if (oldDays.length) {
    // the old index was unique on day alone, which two counters of one day would break
    await MailDay.collection.dropIndex('day_1').catch(() => {});
    await MailDay.collection.deleteMany({ scope: { $exists: false } });
    if (sender) {
      await MailDay.insertMany(oldDays.flatMap(({ day, sent }) => [
        { day, scope: 'sender', ref: sender._id, sent },
        { day, scope: 'integration', ref: sender.integration, sent },
      ]));
    }
  }
  await MailDay.syncIndexes();
}
