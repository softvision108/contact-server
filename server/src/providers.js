import { Router } from 'express';
import mongoose from 'mongoose';
import { CATEGORIES, COMMERCIAL_FIELDS, Provider, STATUSES, slugify } from './models.js';

const TEXT_FIELDS = [
  'name', 'description', 'website', 'linkedin', 'contactPage', 'isCasinoProvider', 'providerCount',
  'gameCount', 'liveContent', 'headquarters', 'pricing', 'contact', 'content',
];
const LIST_FIELDS = ['aliases', 'emails', 'phones', 'urls', 'notes'];
const SORTS = { order: { order: 1, name: 1 }, name: { name: 1 }, updated: { updatedAt: -1 }, status: { status: 1, name: 1 }, rank: { shortlistRank: 1, name: 1 } };

function cleanList(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(/\r?\n|,/);
  return [...new Set(items.map((v) => String(v).trim()).filter(Boolean))];
}

// Only known fields are accepted; anything else in the body is ignored.
function readBody(body, { partial }) {
  const out = {};
  for (const f of TEXT_FIELDS) if (body[f] !== undefined) out[f] = String(body[f] ?? '').trim();
  for (const f of LIST_FIELDS) if (body[f] !== undefined) out[f] = cleanList(body[f]);
  if (body.categories !== undefined) out.categories = cleanList(body.categories).filter((c) => CATEGORIES.includes(c));
  if (body.status !== undefined) out.status = body.status;
  if (body.order !== undefined) {
    const order = body.order === '' || body.order === null ? null : Number(body.order);
    out.order = Number.isFinite(order) ? order : null;
  }
  if (body.shortlistRank !== undefined) {
    const rank = body.shortlistRank === '' || body.shortlistRank === null ? null : Number(body.shortlistRank);
    out.shortlistRank = Number.isFinite(rank) ? rank : null;
  }
  if (body.commercial && typeof body.commercial === 'object') {
    for (const f of COMMERCIAL_FIELDS) {
      if (body.commercial[f] !== undefined) out[`commercial.${f}`] = String(body.commercial[f] ?? '').trim();
    }
  }
  if (!partial && !out.name) throw httpError(400, 'Name is required');
  if (out.name !== undefined && !out.name) throw httpError(400, 'Name is required');
  if (out.status !== undefined && !STATUSES.includes(out.status)) throw httpError(400, 'Unknown status');
  return out;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function uniqueSlug(name, exceptId) {
  const slug = slugify(name);
  if (!slug) throw httpError(400, 'Name must contain letters or numbers');
  const clash = await Provider.findOne({ slug, _id: { $ne: exceptId } }, { name: 1 });
  if (clash) throw httpError(409, `"${clash.name}" is already in the list`);
  return slug;
}

function findById(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(404, 'Provider not found');
  return Provider.findById(id);
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

export const providersRouter = Router();

providersRouter.get('/meta', (req, res) => res.json({ statuses: STATUSES, categories: CATEGORIES, commercialFields: COMMERCIAL_FIELDS }));

providersRouter.get('/stats', wrap(async (req, res) => {
  const rows = await Provider.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) byStatus[r._id] = r.count;
  res.json({ total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus });
}));

providersRouter.get('/', wrap(async (req, res) => {
  const filter = {};
  const q = String(req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { aliases: rx }, { emails: rx }, { website: rx }, { headquarters: rx }, { content: rx }];
  }
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (CATEGORIES.includes(req.query.category)) filter.categories = req.query.category;
  if (req.query.hasEmail === 'yes') filter['emails.0'] = { $exists: true };
  if (req.query.hasEmail === 'no') filter['emails.0'] = { $exists: false };

  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const sort = SORTS[req.query.sort] || SORTS.order;
  const [items, total] = await Promise.all([
    Provider.find(filter, { evidence: 0, description: 0, content: 0 }).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Provider.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
}));

providersRouter.get('/:id', wrap(async (req, res) => {
  const p = await findById(req.params.id).lean();
  if (!p) throw httpError(404, 'Provider not found');
  res.json(p);
}));

providersRouter.post('/', wrap(async (req, res) => {
  const data = readBody(req.body || {}, { partial: false });
  const commercial = Object.fromEntries(
    Object.entries(data).filter(([k]) => k.startsWith('commercial.')).map(([k, v]) => [k.slice(11), v]),
  );
  for (const k of Object.keys(data)) if (k.startsWith('commercial.')) delete data[k];
  if (data.order == null) {
    const last = await Provider.findOne({ order: { $ne: null } }, { order: 1 }).sort({ order: -1 }).lean();
    data.order = (last?.order ?? 0) + 1;
  }
  const p = await Provider.create({ ...data, commercial, slug: await uniqueSlug(data.name), sources: ['manual'] });
  res.status(201).json(p);
}));

providersRouter.put('/:id', wrap(async (req, res) => {
  const p = await findById(req.params.id);
  if (!p) throw httpError(404, 'Provider not found');
  const data = readBody(req.body || {}, { partial: true });
  if (data.name !== undefined && data.name !== p.name) data.slug = await uniqueSlug(data.name, p._id);
  const updated = await Provider.findByIdAndUpdate(p._id, { $set: data }, { new: true, runValidators: true });
  res.json(updated);
}));

providersRouter.delete('/:id', wrap(async (req, res) => {
  const p = await findById(req.params.id);
  if (!p) throw httpError(404, 'Provider not found');
  await p.deleteOne();
  res.json({ ok: true });
}));
