import { readFile } from 'node:fs/promises';
import { Router } from 'express';
import mongoose from 'mongoose';
import { CRYPTO_CATEGORIES, CryptoPartner, STATUSES, slugify } from './models.js';

const TEXT_FIELDS = ['name', 'logo', 'website', 'linkedin', 'contactPage', 'headquarters', 'fees', 'settlement', 'content'];
const LIST_FIELDS = ['aliases', 'coins', 'chains', 'services', 'emails', 'phones', 'socials', 'notes', 'urls'];
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
  if (out.category && !CRYPTO_CATEGORIES.includes(out.category)) throw httpError(400, 'Unknown category');
  return out;
}

async function uniqueSlug(name, exceptId) {
  const slug = slugify(name);
  if (!slug) throw httpError(400, 'Name must contain letters or numbers');
  const clash = await CryptoPartner.findOne({ slug, _id: { $ne: exceptId } }, { name: 1 });
  if (clash) throw httpError(409, `"${clash.name}" is already in the list`);
  return slug;
}

async function findPartner(id) {
  const c = mongoose.isValidObjectId(id) ? await CryptoPartner.findById(id) : null;
  if (!c) throw httpError(404, 'Crypto partner not found');
  return c;
}

// CoinMarketCap's coin list (npm run coins), read once on first use.
let coinList = null;
async function loadCoins() {
  coinList ??= readFile(new URL('../data/coins.json', import.meta.url), 'utf8')
    .then((raw) => JSON.parse(raw).coins)
    .catch(() => []);
  return coinList;
}

const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

export const cryptoPartnersRouter = Router();

cryptoPartnersRouter.get('/stats', wrap(async (req, res) => {
  const rows = await CryptoPartner.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of rows) byStatus[r._id] = r.count;
  res.json({ total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus });
}));

cryptoPartnersRouter.get('/coins', wrap(async (req, res) => {
  const rows = await CryptoPartner.aggregate([
    { $unwind: '$coins' },
    { $group: { _id: '$coins', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]);
  res.json(rows.map((r) => ({ coin: r._id, count: r.count })));
}));

// Coins matching a symbol or name: exact symbol or name first, then by market-cap rank (the file's order).
cryptoPartnersRouter.get('/coin-list', wrap(async (req, res) => {
  const coins = await loadCoins();
  const q = String(req.query.q || '').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const exact = (c) => c.symbol.toLowerCase() === q || c.name.toLowerCase() === q;
  const matches = q
    ? coins.filter((c) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)).sort((a, b) => exact(b) - exact(a))
    : coins;
  res.json({ total: coins.length, items: matches.slice(0, limit) });
}));

cryptoPartnersRouter.get('/', wrap(async (req, res) => {
  const filter = {};
  const q = String(req.query.q || '').trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { aliases: rx }, { emails: rx }, { website: rx }, { headquarters: rx }, { services: rx }, { coins: rx }, { chains: rx }, { socials: rx }, { content: rx }];
  }
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  if (CRYPTO_CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (req.query.coin) filter.coins = String(req.query.coin);
  if (req.query.hasEmail === 'yes') filter['emails.0'] = { $exists: true };
  if (req.query.hasEmail === 'no') filter['emails.0'] = { $exists: false };

  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const sort = SORTS[req.query.sort] || SORTS.order;
  const [items, total] = await Promise.all([
    CryptoPartner.find(filter, { content: 0 }).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    CryptoPartner.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit });
}));

cryptoPartnersRouter.get('/:id', wrap(async (req, res) => res.json(await findPartner(req.params.id))));

cryptoPartnersRouter.post('/', wrap(async (req, res) => {
  const data = readBody(req.body || {}, { partial: false });
  if (data.order == null) {
    const last = await CryptoPartner.findOne({ order: { $ne: null } }, { order: 1 }).sort({ order: -1 }).lean();
    data.order = (last?.order ?? 0) + 1;
  }
  res.status(201).json(await CryptoPartner.create({ ...data, slug: await uniqueSlug(data.name), sources: ['manual'] }));
}));

cryptoPartnersRouter.put('/:id', wrap(async (req, res) => {
  const c = await findPartner(req.params.id);
  const data = readBody(req.body || {}, { partial: true });
  if (data.name !== undefined && data.name !== c.name) data.slug = await uniqueSlug(data.name, c._id);
  res.json(await CryptoPartner.findByIdAndUpdate(c._id, { $set: data }, { new: true, runValidators: true }));
}));

cryptoPartnersRouter.delete('/:id', wrap(async (req, res) => {
  const c = await findPartner(req.params.id);
  await c.deleteOne();
  res.json({ ok: true });
}));
