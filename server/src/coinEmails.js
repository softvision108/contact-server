// Visits each coin's own websites (from data/coin-details.jsonl, npm run coins:details) and collects the email
// addresses they show, into data/coin-emails.jsonl, one JSON line per coin. Needs no database: run it anywhere,
// then `npm run coins:import` where the database is adds the emails to the crypto partner table.
//
//   npm run coins:emails                     every coin with a website not checked yet (resumes where it stopped)
//   npm run coins:emails -- --limit 20       only the next 20
//   npm run coins:emails -- --slug gnodi     only that coin (checked again even if it was before)
//
// Per site it reads the home page, the contact/about/press/legal pages it links to, and the usual /contact paths,
// at most a few pages, one request at a time with a pause between, and skips paths robots.txt disallows.
import { appendFile, readFile } from 'node:fs/promises';

const DETAILS_FILE = new URL('../data/coin-details.jsonl', import.meta.url);
const OUT_FILE = new URL('../data/coin-emails.jsonl', import.meta.url);
const MAX_SITES = 3;
const MAX_PAGES_PER_SITE = 6;
const MAX_BYTES = 3_000_000;
const PAGE_DELAY_MS = 1200;
const GUESSED_PATHS = ['/contact', '/contact-us', '/about', '/about-us'];
const PAGE_HINT = /contact|about|team|press|media|imprint|impressum|legal|privacy|terms|support/i;
// Hosts in a coin's links that are not the project's own site.
const NOT_OWN_SITE = /(^|\.)(twitter|x|t|telegram|discord|discordapp|reddit|github|gitlab|facebook|youtube|youtu|linkedin|instagram|tiktok|medium|substack|coinmarketcap|coingecko|etherscan|bscscan|basescan|solscan|jsdelivr|gitbook|notion|google|apple|bit|linktr|warpcast|mirror)\.[a-z.]+$/i;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const limit = Number(arg('--limit')) || Infinity;
const onlySlug = arg('--slug');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const EMAIL_RX = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi;
// Kept, but not worth stopping for: the search goes on to the next site, and these are listed last.
const LEGAL_EMAIL = /^(privacy|legal|dpo|gdpr|abuse|security|compliance|copyright|dmca|data|dataprotection)@/i;
const JUNK_EMAIL =/\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|woff2?|ttf|mp4)$|@(example|domain|email|yourdomain|company|sentry|[a-z0-9.-]*sentry\.io|wixpress|2x|3x)\b|^(no-?reply|donotreply|user|name|your|you|email)@/i;

// Cloudflare "email protection": the address is XOR-encoded in data-cfemail.
function decodeCfEmail(hex) {
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return out;
}

function emailsIn(html) {
  const text = html
    // JSON escapes in page data (Next.js...): >, @
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#64;|&#x40;|&commat;/gi, '@')
    .replace(/&#46;|&period;/gi, '.')
    .replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@')
    .replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.');
  const found = [
    ...[...text.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) => decodeURIComponent(m[1])),
    ...[...text.matchAll(/data-cfemail="([0-9a-f]+)"/gi)].map((m) => decodeCfEmail(m[1])),
    ...(text.match(EMAIL_RX) || []),
  ];
  return found.map((e) => e.trim().toLowerCase().replace(/[.,;:]+$/, '')).filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) && !JUNK_EMAIL.test(e));
}

function linksIn(html, base) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    if (!PAGE_HINT.test(m[1]) && !PAGE_HINT.test(m[2].replace(/<[^>]+>/g, ''))) continue;
    try {
      const u = new URL(m[1], base);
      if (u.origin === base.origin && !/\.(pdf|png|jpe?g|svg|zip)$/i.test(u.pathname)) out.push(`${u.origin}${u.pathname}`);
    } catch {}
  }
  return out;
}

async function get(url) {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
  if (!res.ok || !/text\/html|text\/plain/i.test(res.headers.get('content-type') || '')) return null;
  const text = await res.text();
  return { url: res.url, html: text.slice(0, MAX_BYTES) };
}

// Disallowed path prefixes for every robot ("User-agent: *"); a missing robots.txt allows everything.
async function robotsRules(origin) {
  const page = await get(`${origin}/robots.txt`).catch(() => null);
  const rules = [];
  let forAll = false;
  for (const raw of (page?.html || '').split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (/^user-agent$/i.test(key)) forAll = value === '*';
    else if (forAll && /^disallow$/i.test(key) && value) rules.push(value);
  }
  return (path) => !rules.some((r) => path.startsWith(r));
}

// The project's own sites: its websites first, then other non-social hosts in its links (blog domain...).
function sitesOf(d) {
  const origins = [];
  for (const u of [...(d.website || []), ...(d.socials || []), ...(d.docs || [])]) {
    try {
      const { origin, hostname } = new URL(u);
      if (!NOT_OWN_SITE.test(hostname) && !origins.includes(origin)) origins.push(origin);
    } catch {}
  }
  return origins.slice(0, MAX_SITES);
}

async function emailsOfSite(origin) {
  const allowed = await robotsRules(origin);
  const queue = [`${origin}/`];
  const seen = new Set();
  const emails = new Set();
  const pages = [];
  while (queue.length && seen.size < MAX_PAGES_PER_SITE) {
    const url = queue.shift();
    if (seen.has(url) || !allowed(new URL(url).pathname)) continue;
    seen.add(url);
    await sleep(PAGE_DELAY_MS);
    const page = await get(url).catch(() => null);
    if (!page) continue;
    const found = emailsIn(page.html);
    if (found.length) pages.push(url);
    for (const e of found) emails.add(e);
    if (seen.size === 1) {
      // home page: follow its contact-like links first, then try the usual paths
      const base = new URL(page.url);
      queue.push(...linksIn(page.html, base), ...GUESSED_PATHS.map((p) => `${base.origin}${p}`));
    }
  }
  return { emails: [...emails], pages };
}

async function main() {
  const details = (await readFile(DETAILS_FILE, 'utf8').catch(() => '')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const done = new Set(
    (await readFile(OUT_FILE, 'utf8').catch(() => '')).split('\n').filter(Boolean).map((l) => JSON.parse(l).slug),
  );
  const todo = details
    .filter((d) => !d.missing && (onlySlug ? d.slug === onlySlug : !done.has(d.slug)))
    .filter((d) => sitesOf(d).length)
    .slice(0, limit);
  console.log(`${done.size} already checked, ${todo.length} to go`);

  let stop = false;
  process.on('SIGINT', () => {
    console.log('\nStopping after this coin...');
    stop = true;
  });

  let withEmail = 0;
  for (const [i, d] of todo.entries()) {
    if (stop) break;
    const emails = new Set();
    const pages = [];
    const sites = sitesOf(d);
    for (const origin of sites) {
      const r = await emailsOfSite(origin);
      r.emails.forEach((e) => emails.add(e));
      pages.push(...r.pages);
      if ([...emails].some((e) => !LEGAL_EMAIL.test(e))) break; // the first site with a real contact address is enough
    }
    // contact addresses before legal ones, then the project's own domains first
    const own = sites.map((o) => new URL(o).hostname.replace(/^www\./, ''));
    const score = (e) => (LEGAL_EMAIL.test(e) ? 0 : 2) + (own.some((h) => e.endsWith(`@${h}`)) ? 1 : 0);
    const sorted = [...emails].sort((a, b) => score(b) - score(a)).slice(0, 10);
    await appendFile(OUT_FILE, `${JSON.stringify({ slug: d.slug, emails: sorted, pages, sites, checkedAt: new Date().toISOString() })}\n`);
    if (sorted.length) withEmail++;
    if (onlySlug || (i + 1) % 25 === 0) console.log(`${i + 1}/${todo.length} ${d.slug}: ${sorted.join(', ') || 'no email'}`);
  }
  console.log(`Done: ${withEmail} coins with emails, written to data/coin-emails.jsonl`);
}

await main();
