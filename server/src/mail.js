import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import mongoose from 'mongoose';
import { config } from './config.js';
import { DEFAULT_DAILY_MAIL_LIMIT, License, MailDay, Person, Provider, Setting, Streamer } from './models.js';
import { isResendConfigured, resendFrom, sendResendMail } from './resend.js';

// Each list the app can email from: how to name a row and which addresses it has.
const LISTS = {
  providers: { model: Provider, name: (d) => d.name, emails: (d) => d.emails },
  people: { model: Person, name: (d) => d.email, emails: (d) => [d.email] },
  licenses: { model: License, name: (d) => d.name, emails: (d) => d.emails },
  streamers: { model: Streamer, name: (d) => d.displayName || d.username, emails: (d) => d.emails },
};
const MAX_PER_JOB = 500;

const { mail } = config;
const isConfigured = () => mail.dryRun || isResendConfigured();
// Dry run does everything but the Resend call, for trying the flow before a key is set.
const deliver = (message) => (mail.dryRun ? Promise.resolve({ messageId: null }) : sendResendMail(message));

// The daily limit counts recipient addresses per UTC day (Resend's own quota resets at 00:00 UTC).
const today = () => new Date().toISOString().slice(0, 10);

async function getDailyLimit() {
  const s = await Setting.findOne({ key: 'mail' }).lean();
  return s ? s.dailyLimit : DEFAULT_DAILY_MAIL_LIMIT;
}

async function usage() {
  const day = today();
  const [dailyLimit, counter] = await Promise.all([getDailyLimit(), MailDay.findOne({ day }).lean()]);
  const sentToday = counter?.sent || 0;
  return { day, dailyLimit, sentToday, remaining: Math.max(0, dailyLimit - sentToday) };
}

// Takes `n` slots from today's budget in one atomic update; false when it would go over the limit.
async function reserve(n) {
  const day = today();
  const limit = await getDailyLimit();
  if (n > limit) return false;
  await MailDay.updateOne({ day }, { $setOnInsert: { sent: 0 } }, { upsert: true }).catch((err) => {
    if (err.code !== 11000) throw err; // two sends creating the day at once
  });
  const res = await MailDay.updateOne({ day, sent: { $lte: limit - n } }, { $inc: { sent: n } });
  return res.modifiedCount === 1;
}

// A refused send did not use Resend's quota, so its slots go back.
const release = (n) => MailDay.updateOne({ day: today() }, { $inc: { sent: -n } });

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

async function runJob(job, { model, name, emails }, { subject, body, allEmails }) {
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
      if (!(await reserve(recipients.length))) {
        result.error = 'Daily email limit reached';
        continue;
      }
      result.state = 'sending';
      const text = render(body, row, result.name, to[0]);
      const subjectLine = render(subject, row, result.name, to[0]);
      try {
        await deliver({ to: recipients, subject: subjectLine, text, replyTo: mail.replyTo });
        result.state = 'sent';
        await model.updateOne({ _id: id }, {
          $set: { lastEmailAt: new Date(), lastEmailSubject: subjectLine, lastEmailError: '' },
          $inc: { emailCount: 1 },
        });
        // replied/blocked are decisions made in the app, so only a fresh row moves to sent.
        await model.updateOne({ _id: id, status: 'ready' }, { $set: { status: 'sent' } });
      } catch (err) {
        result.state = 'failed';
        result.error = err.message;
        await release(recipients.length);
        await model.updateOne({ _id: id }, { $set: { lastEmailError: err.message.slice(0, 500) } });
      }
      if (job.done + 1 < job.total) await sleep(mail.delayMs);
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

mailRouter.get('/config', wrap(async (req, res) => {
  res.json({
    provider: 'resend',
    configured: isConfigured(),
    from: resendFrom(),
    replyTo: mail.replyTo,
    dryRun: mail.dryRun,
    delayMs: mail.delayMs,
    maxPerJob: MAX_PER_JOB,
    ...(await usage()),
  });
}));

mailRouter.put('/settings', wrap(async (req, res) => {
  const dailyLimit = Number(req.body?.dailyLimit);
  if (!Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > 100000) {
    throw httpError(400, 'Daily limit must be a whole number from 0 to 100000');
  }
  await Setting.updateOne({ key: 'mail' }, { $set: { dailyLimit } }, { upsert: true });
  res.json(await usage());
}));

mailRouter.post('/send', wrap(async (req, res) => {
  if (!isConfigured()) throw httpError(400, 'Email is not set up: fill RESEND_API_KEY and RESEND_FROM in server/.env and restart the API');
  const { list, subject, body, allEmails } = req.body || {};
  const target = LISTS[list];
  if (!target) throw httpError(400, 'Unknown list');
  const ids = [...new Set((Array.isArray(req.body.ids) ? req.body.ids : []).map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (!ids.length) throw httpError(400, 'Select at least one row');
  if (ids.length > MAX_PER_JOB) throw httpError(400, `At most ${MAX_PER_JOB} rows per send`);
  if (!String(subject || '').trim()) throw httpError(400, 'Subject is required');
  if (!String(body || '').trim()) throw httpError(400, 'Message is required');
  if ([...jobs.values()].some((j) => !j.finishedAt)) throw httpError(409, 'Another send is still running, wait for it to finish');
  const { remaining, dailyLimit } = await usage();
  if (!remaining) throw httpError(429, `Daily email limit reached (${dailyLimit} per day). Raise it in Settings or try again tomorrow (UTC).`);

  const job = { id: randomUUID(), list, ids, total: ids.length, done: 0, results: [], startedAt: new Date(), finishedAt: null };
  jobs.set(job.id, job);
  void runJob(job, target, { subject: String(subject).trim(), body: String(body), allEmails: Boolean(allEmails) });
  // Finished jobs are kept for an hour so a reloaded page can still read the result.
  for (const [id, j] of jobs) if (j.finishedAt && Date.now() - j.finishedAt > 3600_000) jobs.delete(id);
  res.status(202).json(summary(job));
}));

mailRouter.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Send job not found (the API may have restarted)' });
  res.json(summary(job));
});
