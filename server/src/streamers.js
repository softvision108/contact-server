import { Router } from 'express';
import mongoose from 'mongoose';
import { PLATFORMS, STATUSES, Streamer } from './models.js';

const TEXT_FIELDS = ['displayName', 'category', 'language', 'country', 'bio', 'lastTitle', 'content'];
const LIST_FIELDS = ['emails', 'socials', 'notes'];
const SORTS = {
  followers: { followers: -1, username: 1 },
  viewers: { viewers: -1, username: 1 },
  name: { username: 1 },
  updated: { updatedAt: -1 },
  status: { status: 1, followers: -1 },
};

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function cleanList(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(/\r?\n|,/);
  return [...new Set(items.map((v) => String(v).trim()).filter(Boolean))];
}

function cleanNumber(value) {
  if (value === '' || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readBody(body, { partial }) {
  const out = {};
  for (const f of TEXT_FIELDS) if (body[f] !== undefined) out[f] = String(body[f] ?? '').trim();
  for (const f of LIST_FIELDS) if (body[f] !== undefined) out[f] = cleanList(body[f]);
  if (body.platform !== undefined) out.platform = String(body.platform || '');
  if (body.username !== undefined) out.username = String(body.username || '').trim().replace(/^@/, '').toLowerCase();
  if (body.followers !== undefined) out.followers = cleanNumber(body.followers);
  if (body.viewers !== undefined) out.viewers = cleanNumber(body.viewers);
  if (body.verified !== undefined) out.verified = Boolean(body.verified);
  if (body.status !== undefined) out.status = body.status;
  if ((!partial || out.username !== undefined) && !out.username) throw httpError(400, 'Username is required');
  if ((!partial || out.platform !== undefined) && !PLATFORMS.includes(out.platform)) throw httpError(400, 'Unknown platform');
  if (out.status !== undefined && !STATUSES.includes(out.status)) throw httpError(400, 'Unknown status');
  return out;
}

async function uniqueSlug(platform, username, exceptId) {
  if (!/^[a-z0-9_.-]+$/.test(username)) throw httpError(400, 'Username can only contain letters, numbers, _ . and -');
  const slug = `${platform}-${username}`;
  const clash = await Streamer.findOne({ slug, _id: { $ne: exceptId } }, { username: 1 });
  if (clash) throw httpError(409, `${platform}/${username} is already in the list`);
  return slug;
}

async function findStreamer(id) {
  const s = mongoose.isValidObjectId(id) ? await Streamer.findById(id) : null;
  if (!s) throw httpError(404, 'Streamer not found');
  return s;
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

export const streamersRouter = Router();

streamersRouter.get('/stats', wrap(async (req, res) => {
  const rows = await Streamer.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) byStatus[r._id] = r.count;
  res.json({ total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus });
}));

// Categories and languages in use, for the filter dropdowns.
streamersRouter.get('/facets', wrap(async (req, res) => {
  const count = (field) => Streamer.aggregate([
    { $match: { [field]: { $ne: '' } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  const [categories, languages] = await Promise.all([count('category'), count('language')]);
  res.json({
    categories: categories.map((r) => ({ value: r._id, count: r.count })),
    languages: languages.map((r) => ({ value: r._id, count: r.count })),
  });
}));

streamersRouter.get('/', wrap(async (req, res) => {
  const filter = {};
  const q = String(req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ username: rx }, { displayName: rx }, { bio: rx }, { emails: rx }, { socials: rx }, { lastTitle: rx }, { content: rx }];
  }
  if (PLATFORMS.includes(req.query.platform)) filter.platform = req.query.platform;
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (req.query.category) filter.category = String(req.query.category);
  if (req.query.language) filter.language = String(req.query.language);
  if (req.query.hasEmail === 'yes') filter['emails.0'] = { $exists: true };
  if (req.query.hasEmail === 'no') filter['emails.0'] = { $exists: false };
  const minFollowers = cleanNumber(req.query.minFollowers ?? '');
  if (minFollowers) filter.followers = { $gte: minFollowers };

  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const sort = SORTS[req.query.sort] || SORTS.followers;
  const [items, total] = await Promise.all([
    Streamer.find(filter, { content: 0 }).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Streamer.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
}));

streamersRouter.get('/:id', wrap(async (req, res) => res.json(await findStreamer(req.params.id))));

streamersRouter.post('/', wrap(async (req, res) => {
  const data = readBody(req.body || {}, { partial: false });
  const slug = await uniqueSlug(data.platform, data.username);
  res.status(201).json(await Streamer.create({ ...data, slug, sources: ['manual'] }));
}));

streamersRouter.put('/:id', wrap(async (req, res) => {
  const s = await findStreamer(req.params.id);
  const data = readBody(req.body || {}, { partial: true });
  const platform = data.platform ?? s.platform;
  const username = data.username ?? s.username;
  if (platform !== s.platform || username !== s.username) data.slug = await uniqueSlug(platform, username, s._id);
  res.json(await Streamer.findByIdAndUpdate(s._id, { $set: data }, { new: true, runValidators: true }));
}));

streamersRouter.delete('/:id', wrap(async (req, res) => {
  const s = await findStreamer(req.params.id);
  await s.deleteOne();
  res.json({ ok: true });
}));
