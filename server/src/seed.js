// Creates the admin account if it is missing, then imports contacts.json, the people export, licences and streamers.
// Safe to run again: providers match by slug, people by email, and status/content set in the app are never overwritten.
// A provider or person no longer in its source is removed only if it was never edited in the app.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { COMMERCIAL_FIELDS, License, Person, Provider, Streamer, User, slugify } from './models.js';
import { POPULAR } from './popularity.js';

const username = (process.env.SEED_ADMIN_USERNAME || 'admin').toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
const contactsFile = process.env.SEED_CONTACTS_FILE;
const peopleDir = process.env.SEED_PEOPLE_DIR;
const licenseFile = process.env.SEED_LICENSE_FILE;
const streamersFile = process.env.SEED_STREAMERS_FILE;

await mongoose.connect(config.mongoUri);

if (await User.exists({ username })) {
  console.log(`User "${username}" already exists, password left unchanged`);
} else if (!password) {
  console.error('SEED_ADMIN_PASSWORD is empty, user not created');
} else {
  await User.create({ username, passwordHash: await bcrypt.hash(password, 12) });
  console.log(`User "${username}" created`);
}

if (contactsFile) {
  const data = JSON.parse(await readFile(path.resolve(contactsFile), 'utf8'));
  const text = (v) => (v === null || v === undefined ? '' : String(v));
  const ops = data.companies.map((c) => ({
    updateOne: {
      filter: { slug: c.id || slugify(c.name) },
      update: {
        $set: {
          name: c.name,
          aliases: c.aliases || [],
          categories: c.categories || [],
          description: text(c.description),
          website: text(c.website),
          linkedin: text(c.linkedin),
          contactPage: text(c.contactPage),
          isCasinoProvider: text(c.isCasinoProvider),
          providerCount: text(c.providerCount),
          gameCount: text(c.gameCount),
          liveContent: text(c.liveContent),
          headquarters: text(c.headquarters),
          pricing: text(c.pricing),
          contact: text(c.contact),
          shortlistRank: c.shortlistRank ?? null,
          emails: c.emails || [],
          phones: c.phones || [],
          urls: c.urls || [],
          notes: c.notes || [],
          evidence: c.evidence || {},
          sources: c.sources || [],
        },
        $setOnInsert: {
          status: 'ready',
          content: '',
          commercial: Object.fromEntries(COMMERCIAL_FIELDS.map((f) => [f, text(c.commercial?.[f])])),
        },
      },
      upsert: true,
      // Keeps updatedAt meaning "last changed in the app" instead of "last sync".
      timestamps: false,
    },
  }));
  const r = await Provider.bulkWrite(ops);
  console.log(`Providers: ${r.upsertedCount} added, ${r.modifiedCount} changed, ${data.companies.length} in file`);

  // Rows that left contacts.json (merged or removed there) go too, but only if nobody worked on them in the app.
  const slugs = data.companies.map((c) => c.id || slugify(c.name));
  const pruned = await Provider.deleteMany({ slug: { $nin: slugs }, status: 'ready', content: '', sources: { $ne: 'manual' } });
  const kept = await Provider.countDocuments({ slug: { $nin: slugs } });
  console.log(`Providers: ${pruned.deletedCount} no longer in file removed${kept ? `, ${kept} kept (edited in the app or added by hand)` : ''}`);

  // Initial order only: rows that already have one (set in the app or an earlier seed) keep it.
  const rank = new Map(POPULAR.map((slug, i) => [slug, i]));
  const ranked = data.companies
    .map((c, i) => ({ slug: c.id || slugify(c.name), name: c.name, mentions: (c.sources || []).length, i }))
    .sort((a, b) => (rank.get(a.slug) ?? Infinity) - (rank.get(b.slug) ?? Infinity) || b.mentions - a.mentions || a.name.localeCompare(b.name));
  const last = await Provider.findOne({ order: { $ne: null } }, { order: 1 }).sort({ order: -1 }).lean();
  let next = last?.order ?? 0;
  const missing = new Set((await Provider.find({ order: null }, { slug: 1 }).lean()).map((p) => p.slug));
  const orderOps = ranked.filter((p) => missing.has(p.slug)).map((p) => ({
    updateOne: { filter: { slug: p.slug, order: null }, update: { $set: { order: ++next } } },
  }));
  if (orderOps.length) await Provider.bulkWrite(orderOps);
  console.log(`Providers: order set on ${orderOps.length}`);
}

if (peopleDir) {
  // Folder per country, each with enhanced.csv (real users) and perfect.csv (best-quality subset).
  const readCsv = async (file) => {
    const raw = await readFile(file, 'utf8').catch(() => '');
    const [head, ...lines] = raw.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
    const cols = (head || '').split(',').map((c) => c.trim());
    return lines.map((line) => Object.fromEntries(line.split(',').map((v, i) => [cols[i], v.trim()])));
  };
  const people = new Map();
  for (const country of (await readdir(peopleDir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const perfect = new Set((await readCsv(path.join(peopleDir, country, 'perfect.csv'))).map((r) => r.email?.toLowerCase()));
    for (const r of await readCsv(path.join(peopleDir, country, 'enhanced.csv'))) {
      const email = r.email?.toLowerCase();
      if (!email) continue;
      const row = { email, phone: r.phone || '', country, countryCode: r.country || '', quality: perfect.has(email) ? 'perfect' : 'normal' };
      const seen = people.get(email);
      // Same email in two countries: keep the perfect row, else the first one.
      if (!seen || (seen.quality === 'normal' && row.quality === 'perfect')) people.set(email, row);
    }
  }
  const ops = [...people.values()].map((row) => ({
    updateOne: {
      filter: { email: row.email },
      update: { $set: row, $setOnInsert: { status: 'ready', content: '' } },
      upsert: true,
      timestamps: false,
    },
  }));
  let added = 0;
  let changed = 0;
  for (let i = 0; i < ops.length; i += 2000) {
    const res = await Person.bulkWrite(ops.slice(i, i + 2000), { ordered: false });
    added += res.upsertedCount;
    changed += res.modifiedCount;
  }
  // Same rule as providers: rows no longer in the export go only if nobody worked on them in the app.
  const pruned = await Person.deleteMany({ email: { $nin: [...people.keys()] }, status: 'ready', content: '' });
  const kept = await Person.countDocuments({ email: { $nin: [...people.keys()] } });
  console.log(`People: ${added} added, ${changed} changed, ${people.size} unique emails in folder, ${pruned.deletedCount} no longer in folder removed${kept ? `, ${kept} kept (edited in the app or added by hand)` : ''}`);
}

if (licenseFile) {
  // licenses.json: { companies: [...] } in ranked order; that order is the initial `order`.
  const raw = await readFile(path.resolve(licenseFile), 'utf8').catch(() => null);
  const data = raw ? JSON.parse(raw) : { companies: [] };
  if (!raw) console.log(`Licenses: ${licenseFile} not found, skipped`);
  const text = (v) => (v === null || v === undefined ? '' : String(v));
  const rows = data.companies.map((c, i) => ({
    slug: c.id || slugify(c.name),
    rank: i + 1,
    fields: {
      name: c.name,
      aliases: c.aliases || [],
      category: text(c.category),
      jurisdictions: c.jurisdictions || [],
      services: c.services || [],
      website: text(c.website),
      linkedin: text(c.linkedin),
      contactPage: text(c.contactPage),
      emails: c.emails || [],
      phones: c.phones || [],
      headquarters: text(c.headquarters),
      pricing: text(c.pricing),
      timeline: text(c.timeline),
      notes: c.notes || [],
      urls: c.urls || [],
      sources: c.sources || [],
    },
  }));
  const r = rows.length === 0 ? { upsertedCount: 0, modifiedCount: 0 } : await License.bulkWrite(rows.map((row) => ({
    updateOne: {
      filter: { slug: row.slug },
      update: { $set: row.fields, $setOnInsert: { status: 'ready', content: '', order: row.rank } },
      upsert: true,
      timestamps: false,
    },
  })));
  // An empty or missing file must never wipe the table.
  const pruned = rows.length === 0 ? { deletedCount: 0 } : await License.deleteMany({ slug: { $nin: rows.map((x) => x.slug) }, status: 'ready', content: '', sources: { $ne: 'manual' } });
  console.log(`Licenses: ${r.upsertedCount} added, ${r.modifiedCount} changed, ${rows.length} in file, ${pruned.deletedCount} no longer in file removed`);
}

if (streamersFile) {
  // streamers.json: { scrapedAt, streamers: [...] }, the casino/slots/poker channels seen live on Kick and Twitch.
  // Streams come and go, so a streamer missing from a newer scrape is kept (it was only offline).
  const raw = await readFile(path.resolve(streamersFile), 'utf8').catch(() => null);
  const data = raw ? JSON.parse(raw) : { streamers: [] };
  if (!raw) console.log(`Streamers: ${streamersFile} not found, skipped`);
  const text = (v) => (v === null || v === undefined ? '' : String(v));
  const ops = data.streamers.map((s) => {
    const username = s.username.toLowerCase();
    return {
      updateOne: {
        filter: { slug: `${s.platform}-${username}` },
        update: {
          $set: {
            platform: s.platform,
            username,
            displayName: text(s.displayName),
            category: text(s.category),
            language: text(s.language),
            country: text(s.country),
            followers: s.followers ?? null,
            viewers: s.viewers ?? null,
            verified: Boolean(s.verified),
            bio: text(s.bio),
            lastTitle: text(s.lastTitle),
            lastLiveAt: s.lastLiveAt ? new Date(s.lastLiveAt) : null,
          },
          // Emails and links added in the app stay; new ones from the scrape are added.
          $addToSet: { emails: { $each: s.emails || [] }, socials: { $each: s.socials || [] }, sources: `${s.platform}-scrape` },
          $setOnInsert: { status: 'ready', content: '' },
        },
        upsert: true,
        timestamps: false,
      },
    };
  });
  const r = ops.length ? await Streamer.bulkWrite(ops, { ordered: false }) : { upsertedCount: 0, modifiedCount: 0 };
  console.log(`Streamers: ${r.upsertedCount} added, ${r.modifiedCount} changed, ${ops.length} in file`);
}

await mongoose.disconnect();
