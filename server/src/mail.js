import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import { config } from './config.js';
import { DEFAULT_DAILY_MAIL_LIMIT, DEFAULT_MAIL_DELAY_MS, License, MailDay, Person, Provider, Setting, Streamer } from './models.js';
import { accountsRouter, fromLine, listAccounts, loadSender } from './mailAccounts.js';
import { sendResendMail } from './resend.js';

// Each list the app can email from: how to name a row and which addresses it has.
const LISTS = {
  providers: { model: Provider, name: (d) => d.name, emails: (d) => d.emails },
  people: { model: Person, name: (d) => d.email, emails: (d) => [d.email] },
  licenses: { model: License, name: (d) => d.name, emails: (d) => d.emails },
  streamers: { model: Streamer, name: (d) => d.displayName || d.username, emails: (d) => d.emails },
};
const MAX_PER_JOB = 500;

const { mail } = config;
// Dry run does everything but the Resend call, for trying the flow before a key is set.
const deliver = (message) => (mail.dryRun ? Promise.resolve({ messageId: null }) : sendResendMail(message));

// The daily limit counts recipient addresses per UTC day (Resend's own quota resets at 00:00 UTC),
// once for the sender and once for its Resend account: both have to stay under it.
const today = () => new Date().toISOString().slice(0, 10);

async function getSettings() {
  const s = await Setting.findOne({ key: 'mail' }).lean();
  return { dailyLimit: s?.dailyLimit ?? DEFAULT_DAILY_MAIL_LIMIT, delayMs: s?.delayMs ?? DEFAULT_MAIL_DELAY_MS };
}

// Every sender and integration with today's count and what is left of the limit.
async function overview() {
  const day = today();
  const [{ dailyLimit, delayMs }, accounts, counters] = await Promise.all([getSettings(), listAccounts(), MailDay.find({ day }).lean()]);
  const sentBy = (scope, id) => counters.find((c) => c.scope === scope && String(c.ref) === id)?.sent || 0;
  const left = (sent) => Math.max(0, dailyLimit - sent);
  const integrations = accounts.integrations.map((i) => {
    const sentToday = sentBy('integration', i.id);
    return { ...i, sentToday, remaining: left(sentToday) };
  });
  const senders = accounts.senders.map((s) => {
    const integration = integrations.find((i) => i.id === s.integration);
    const sentToday = sentBy('sender', s.id);
    const usable = Boolean(s.enabled && integration?.enabled);
    // the sender's own count, capped by what its Resend account has left
    const remaining = usable ? Math.min(left(sentToday), integration.remaining) : 0;
    return { ...s, integrationName: integration?.name || '', usable, sentToday, remaining };
  });
  return { day, dailyLimit, delayMs, integrations, senders };
}

// Takes `n` from today's count of one counter, in one atomic update; false when it would go over the limit.
async function take(day, scope, ref, n, limit) {
  await MailDay.updateOne({ day, scope, ref }, { $setOnInsert: { sent: 0 } }, { upsert: true }).catch((err) => {
    if (err.code !== 11000) throw err; // two sends creating the day at once
  });
  const res = await MailDay.updateOne({ day, scope, ref, sent: { $lte: limit - n } }, { $inc: { sent: n } });
  return res.modifiedCount === 1;
}

const giveBack = (day, scope, ref, n) => MailDay.updateOne({ day, scope, ref }, { $inc: { sent: -n } });

// Reserves `n` slots for the sender and its integration; false (and nothing taken) when either is full.
async function reserve(sender, n) {
  const day = today();
  const { dailyLimit } = await getSettings();
  if (n > dailyLimit) return false;
  if (!(await take(day, 'sender', sender._id, n, dailyLimit))) return false;
  if (await take(day, 'integration', sender.integration, n, dailyLimit)) return { day, n };
  await giveBack(day, 'sender', sender._id, n);
  return false;
}

// A refused send did not use Resend's quota, so its slots go back (to the day they were taken from).
const release = (sender, { day, n }) => Promise.all([
  giveBack(day, 'sender', sender._id, n),
  giveBack(day, 'integration', sender.integration, n),
]);

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// {{name}}, {{email}} and any other field of the row ({{username}}, {{platform}}, {{country}}...).
function render(template, row, name, email) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    if (key === 'name') return name;
    if (key === 'email') return email;
    const v = row[key];
    return v === null || v === undefined || typeof v === 'object' ? '' : String(v);
  });
}

// Jobs live in memory: the browser polls them while they run, and they are gone after a restart.
const jobs = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runJob(job, { model, name, emails }, { subject, body, allEmails }, { sender, apiKey }, delayMs) {
  const from = fromLine(sender);
  for (const id of job.ids) {
    const result = { id, name: '', to: '', state: 'skipped', error: '' };
    job.results.push(result);
    try {
      const row = await model.findById(id).lean();
      if (!row) {
        result.error = 'Row no longer exists';
        continue;
      }
      result.name = name(row);
      const to = (emails(row) || []).filter(Boolean);
      if (!to.length) {
        result.error = 'No email address';
        continue;
      }
      if (row.status === 'blocked') {
        result.error = 'Status is blocked';
        continue;
      }
      const recipients = allEmails ? to : to.slice(0, 1);
      result.to = recipients.join(', ');
      const slot = await reserve(sender, recipients.length);
      if (!slot) {
        result.error = 'Daily email limit reached (sender or Resend account)';
        continue;
      }
      result.state = 'sending';
      const text = render(body, row, result.name, to[0]);
      const subjectLine = render(subject, row, result.name, to[0]);
      try {
        await deliver({ apiKey, from, to: recipients, subject: subjectLine, text, replyTo: sender.replyTo });
        result.state = 'sent';
        await model.updateOne({ _id: id }, {
          $set: { lastEmailAt: new Date(), lastEmailSubject: subjectLine, lastEmailFrom: from, lastEmailError: '' },
          $inc: { emailCount: 1 },
        });
        // replied/blocked are decisions made in the app, so only a fresh row moves to sent.
        await model.updateOne({ _id: id, status: 'ready' }, { $set: { status: 'sent' } });
      } catch (err) {
        result.state = 'failed';
        result.error = err.message;
        await release(sender, slot);
        await model.updateOne({ _id: id }, { $set: { lastEmailError: err.message.slice(0, 500) } });
      }
      if (job.done + 1 < job.total) await sleep(delayMs);
    } catch (err) {
      result.state = 'failed';
      result.error = err.message;
    } finally {
      job.done += 1;
    }
  }
  job.finishedAt = new Date();
}

function summary(job) {
  const count = (state) => job.results.filter((r) => r.state === state).length;
  return {
    id: job.id,
    list: job.list,
    from: job.from,
    total: job.total,
    done: job.done,
    sent: count('sent'),
    failed: count('failed'),
    skipped: count('skipped'),
    finished: Boolean(job.finishedAt),
    dryRun: mail.dryRun,
    results: job.results,
  };
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

export const mailRouter = Router();
mailRouter.use(accountsRouter);

mailRouter.get('/config', wrap(async (req, res) => {
  const o = await overview();
  res.json({
    ...o,
    provider: 'resend',
    configured: o.senders.some((s) => s.usable),
    dryRun: mail.dryRun,
    maxPerJob: MAX_PER_JOB,
  });
}));

mailRouter.put('/settings', wrap(async (req, res) => {
  const dailyLimit = Number(req.body?.dailyLimit);
  const delayMs = Number(req.body?.delayMs);
  if (!Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > 100000) {
    throw httpError(400, 'Daily limit must be a whole number from 0 to 100000');
  }
  if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60000) {
    throw httpError(400, 'Pause must be from 0 to 60 seconds');
  }
  await Setting.updateOne({ key: 'mail' }, { $set: { dailyLimit, delayMs } }, { upsert: true });
  res.json(await overview());
}));

mailRouter.post('/send', wrap(async (req, res) => {
  const { list, subject, body, allEmails, senderId } = req.body || {};
  const target = LISTS[list];
  if (!target) throw httpError(400, 'Unknown list');
  const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) throw httpError(400, 'Select at least one row');
  if (ids.length > MAX_PER_JOB) throw httpError(400, `At most ${MAX_PER_JOB} rows per send`);
  if (!String(subject || '').trim()) throw httpError(400, 'Subject is required');
  if (!String(body || '').trim()) throw httpError(400, 'Message is required');
  const account = await loadSender(senderId);
  const senderKey = String(account.sender._id);
  if ([...jobs.values()].some((j) => !j.finishedAt && j.senderId === senderKey)) {
    throw httpError(409, 'This sender is still sending, wait for it to finish or pick another sender');
  }
  const o = await overview();
  const { remaining } = o.senders.find((s) => s.id === senderKey);
  if (!remaining) throw httpError(429, `Daily email limit reached for ${fromLine(account.sender)} or its Resend account (${o.dailyLimit} per day). Pick another sender, raise the limit in Settings, or try again tomorrow (UTC).`);

  const job = { id: randomUUID(), list, senderId: senderKey, from: fromLine(account.sender), ids, total: ids.length, done: 0, results: [], startedAt: new Date(), finishedAt: null };
  jobs.set(job.id, job);
  void runJob(job, target, { subject: String(subject).trim(), body: String(body), allEmails: Boolean(allEmails) }, account, o.delayMs);
  // Finished jobs are kept for an hour so a reloaded page can still read the result.
  for (const [id, j] of jobs) if (j.finishedAt && Date.now() - j.finishedAt > 3600_000) jobs.delete(id);
  res.status(202).json(summary(job));
}));

mailRouter.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Send job not found (the API may have restarted)' });
  res.json(summary(job));
});
