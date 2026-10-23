import { Router } from 'express';
import mongoose from 'mongoose';
import { LICENSE_CATEGORIES, License, STATUSES, slugify } from './models.js';

const TEXT_FIELDS = ['name', 'website', 'linkedin', 'contactPage', 'headquarters', 'pricing', 'timeline', 'content'];
const LIST_FIELDS = ['aliases', 'jurisdictions', 'services', 'emails', 'phones', 'notes', 'urls'];
const SORTS = { order: { order: 1, name: 1 }, name: { name: 1 }, updated: { updatedAt: -1 }, status: { status: 1, name: 1 } };

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function cleanList(value) {
  const items = Array.isArray(value) ? value : String(value || '').split(/\r?\n|,/);
  return [...new Set(items.map((v) => String(v).trim()).filter(Boolean))];
}

function readBody(body, { partial }) {
  const out = {};
  for (const f of TEXT_FIELDS) if (body[f] !== undefined) out[f] = String(body[f] ?? '').trim();
  for (const f of LIST_FIELDS) if (body[f] !== undefined) out[f] = cleanList(body[f]);
  if (body.category !== undefined) out.category = String(body.category || '');
  if (body.status !== undefined) out.status = body.status;
  if (body.order !== undefined) {
    const order = body.order === '' || body.order === null ? null : Number(body.order);
    out.order = Number.isFinite(order) ? order : null;
  }
  if ((!partial || out.name !== undefined) && !out.name) throw httpError(400, 'Name is required');
  if (out.status !== undefined && !STATUSES.includes(out.status)) throw httpError(400, 'Unknown status');
  if (out.category && !LICENSE_CATEGORIES.includes(out.category)) throw httpError(400, 'Unknown category');
  return out;
}

async function uniqueSlug(name, exceptId) {
  const slug = slugify(name);
  if (!slug) throw httpError(400, 'Name must contain letters or numbers');
  const clash = await License.findOne({ slug, _id: { $ne: exceptId } }, { name: 1 });
  if (clash) throw httpError(409, `"${clash.name}" is already in the list`);
  return slug;
}

async function findLicense(id) {
  const l = mongoose.isValidObjectId(id) ? await License.findById(id) : null;
  if (!l) throw httpError(404, 'Licence company not found');
  return l;
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

export const licensesRouter = Router();

licensesRouter.get('/stats', wrap(async (req, res) => {
  const rows = await License.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) byStatus[r._id] = r.count;
  res.json({ total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus });
}));

licensesRouter.get('/jurisdictions', wrap(async (req, res) => {
  const rows = await License.aggregate([
    { $unwind: '$jurisdictions' },
    { $group: { _id: '$jurisdictions', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  res.json(rows.map((r) => ({ jurisdiction: r._id, count: r.count })));
}));

licensesRouter.get('/', wrap(async (req, res) => {
  const filter = {};
  const q = String(req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { aliases: rx }, { emails: rx }, { website: rx }, { headquarters: rx }, { services: rx }, { content: rx }];
  }
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (LICENSE_CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (req.query.jurisdiction) filter.jurisdictions = String(req.query.jurisdiction);
  if (req.query.hasEmail === 'yes') filter['emails.0'] = { $exists: true };
  if (req.query.hasEmail === 'no') filter['emails.0'] = { $exists: false };

  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const sort = SORTS[req.query.sort] || SORTS.order;
  const [items, total] = await Promise.all([
    License.find(filter, { content: 0 }).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    License.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
}));

licensesRouter.get('/:id', wrap(async (req, res) => res.json(await findLicense(req.params.id))));

licensesRouter.post('/', wrap(async (req, res) => {
  const data = readBody(req.body || {}, { partial: false });
  if (data.order == null) {
    const last = await License.findOne({ order: { $ne: null } }, { order: 1 }).sort({ order: -1 }).lean();
    data.order = (last?.order ?? 0) + 1;
  }
  res.status(201).json(await License.create({ ...data, slug: await uniqueSlug(data.name), sources: ['manual'] }));
}));

licensesRouter.put('/:id', wrap(async (req, res) => {
  const l = await findLicense(req.params.id);
  const data = readBody(req.body || {}, { partial: true });
  if (data.name !== undefined && data.name !== l.name) data.slug = await uniqueSlug(data.name, l._id);
  res.json(await License.findByIdAndUpdate(l._id, { $set: data }, { new: true, runValidators: true }));
}));

licensesRouter.delete('/:id', wrap(async (req, res) => {
  const l = await findLicense(req.params.id);
  await l.deleteOne();
  res.json({ ok: true });
}));
