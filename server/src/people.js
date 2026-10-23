import { Router } from 'express';
import mongoose from 'mongoose';
import { Person, QUALITIES, STATUSES } from './models.js';

const FIELDS = ['email', 'phone', 'country', 'countryCode', 'content'];
const SORTS = { email: { email: 1 }, country: { country: 1, email: 1 }, updated: { updatedAt: -1 }, status: { status: 1, email: 1 } };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function readBody(body, { partial }) {
  const out = {};
  for (const f of FIELDS) if (body[f] !== undefined) out[f] = String(body[f] ?? '').trim();
  if (out.email !== undefined) out.email = out.email.toLowerCase();
  if (body.status !== undefined) out.status = body.status;
  if (body.quality !== undefined) out.quality = body.quality;
  if ((!partial || out.email !== undefined) && !EMAIL.test(out.email || '')) throw httpError(400, 'A valid email is required');
  if (out.status !== undefined && !STATUSES.includes(out.status)) throw httpError(400, 'Unknown status');
  if (out.quality !== undefined && !QUALITIES.includes(out.quality)) throw httpError(400, 'Unknown quality');
  return out;
}

async function assertFreeEmail(email, exceptId) {
  const clash = await Person.exists({ email, _id: { $ne: exceptId } });
  if (clash) throw httpError(409, `${email} is already in the list`);
}

async function findPerson(id) {
  const p = mongoose.isValidObjectId(id) ? await Person.findById(id) : null;
  if (!p) throw httpError(404, 'Person not found');
  return p;
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

export const peopleRouter = Router();

peopleRouter.get('/stats', wrap(async (req, res) => {
  const rows = await Person.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) byStatus[r._id] = r.count;
  res.json({ total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus });
}));

peopleRouter.get('/countries', wrap(async (req, res) => {
  const rows = await Person.aggregate([{ $group: { _id: '$country', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  res.json(rows.filter((r) => r._id).map((r) => ({ country: r._id, count: r.count })));
}));

peopleRouter.get('/', wrap(async (req, res) => {
  const filter = {};
  const q = String(req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ email: rx }, { phone: rx }, { content: rx }];
  }
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (QUALITIES.includes(req.query.quality)) filter.quality = req.query.quality;
  if (req.query.country) filter.country = String(req.query.country);

  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const sort = SORTS[req.query.sort] || SORTS.email;
  const [items, total] = await Promise.all([
    Person.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Person.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
}));

peopleRouter.get('/:id', wrap(async (req, res) => res.json(await findPerson(req.params.id))));

peopleRouter.post('/', wrap(async (req, res) => {
  const data = readBody(req.body || {}, { partial: false });
  await assertFreeEmail(data.email);
  res.status(201).json(await Person.create(data));
}));

peopleRouter.put('/:id', wrap(async (req, res) => {
  const p = await findPerson(req.params.id);
  const data = readBody(req.body || {}, { partial: true });
  if (data.email !== undefined && data.email !== p.email) await assertFreeEmail(data.email, p._id);
  res.json(await Person.findByIdAndUpdate(p._id, { $set: data }, { new: true, runValidators: true }));
}));

peopleRouter.delete('/:id', wrap(async (req, res) => {
  const p = await findPerson(req.params.id);
  await p.deleteOne();
  res.json({ ok: true });
}));
