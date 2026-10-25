// Adds every coin in data/coins.json (npm run coins) to the crypto partner table, as type "coin-project",
// with its CoinMarketCap logo, the links in data/coin-details.jsonl (npm run coins:details) and the emails in
// data/coin-emails.jsonl (npm run coins:emails) when those files exist.
// Safe to run again: rows match by slug; a row that is already there only gets links, emails, symbol and source added,
// and its website only when it has none, so anything edited in the app is never overwritten.
import mongoose from 'mongoose';
import { readFile } from 'node:fs/promises';
import { config } from './config.js';
import { CryptoPartner, slugify } from './models.js';

const { coins, fetchedAt } = JSON.parse(await readFile(new URL('../data/coins.json', import.meta.url), 'utf8'));
const details = new Map(
  (await readFile(new URL('../data/coin-details.jsonl', import.meta.url), 'utf8').catch(() => ''))
    .split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((d) => !d.missing).map((d) => [d.slug, d]),
);
// last line per coin wins, so a coin checked again replaces its earlier result
const emailsBySlug = new Map(
  (await readFile(new URL('../data/coin-emails.jsonl', import.meta.url), 'utf8').catch(() => ''))
    .split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((e) => [e.slug, e.emails]),
);
const logoOf = (c) => (c.id ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${c.id}.png` : '');

// The app keys partners by slugify(name); several coins share a name ("SOLANA"), so the lower-ranked
// ones fall back to CoinMarketCap's own slug, which is unique.
const used = new Set();
const rows = [];
for (const c of coins) {
  let slug = slugify(c.name);
  if (!slug || used.has(slug)) slug = c.slug;
  for (let n = 2; used.has(slug); n++) slug = `${c.slug}-${n}`;
  used.add(slug);
  rows.push({ slug, coin: c, detail: details.get(c.slug), emails: emailsBySlug.get(c.slug) || [] });
}

function opsFor({ slug, coin: c, detail: d, emails }) {
  const ops = [{
    updateOne: {
      filter: { slug },
      update: {
        $setOnInsert: {
          createdAt: now,
          updatedAt: now,
          name: c.name,
          category: 'coin-project',
          chains: c.platform ? [c.platform] : [],
          order: c.rank,
        },
        $addToSet: {
          coins: c.symbol,
          sources: 'coinmarketcap',
          urls: { $each: [`https://coinmarketcap.com/currencies/${c.slug}/`, ...(d?.website.slice(1) || []), ...(d?.docs || []), ...(d?.explorers || [])] },
          socials: { $each: d?.socials || [] },
          emails: { $each: emails },
        },
      },
      upsert: true,
    },
  }];
  const logo = d?.logo || logoOf(c);
  if (logo) ops.push({ updateOne: { filter: { slug, logo: { $in: ['', null] } }, update: { $set: { logo } } } });
  if (d?.website.length) ops.push({ updateOne: { filter: { slug, website: { $in: ['', null] } }, update: { $set: { website: d.website[0] } } } });
  return ops;
}

const now = new Date();
await mongoose.connect(config.mongoUri);

let inserted = 0;
for (let i = 0; i < rows.length; i += 1000) {
  // timestamps: false keeps "Last updated" for rows that were already there
  const r = await CryptoPartner.bulkWrite(rows.slice(i, i + 1000).flatMap(opsFor), { ordered: true, timestamps: false });
  inserted += r.upsertedCount;
}

const withLinks = rows.filter((r) => r.detail).length;
const withEmails = rows.filter((r) => r.emails.length).length;
console.log(`Coins from CoinMarketCap (${fetchedAt}): ${inserted} added, ${rows.length - inserted} already in the table, links for ${withLinks}, emails for ${withEmails}`);
await mongoose.disconnect();
