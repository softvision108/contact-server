// Fetches each coin's links from CoinMarketCap (website, socials, whitepaper, explorers: what the coin page shows)
// into data/coin-details.jsonl, one JSON line per coin. Needs no database: run it on any machine with the repo,
// then `npm run coins:import` where the database is applies the file to the crypto partner table.
//
//   npm run coins:details               every coin in data/coins.json not fetched yet (resumes where it stopped)
//   npm run coins:details -- --limit 20 only the next 20, to try it
//   npm run coins:details -- --slug gnodi  only that coin
//   npm run coins:details -- --from 501 --limit 100   ranks 501-600
//
// It is deliberately slow and polite: one request at a time, 2.5-4.5 s apart, and on 403/429 or errors it waits
// longer each time and gives up after a few in a row instead of retrying hard. Run it again later to continue.
import { appendFile, readFile } from 'node:fs/promises';

const COINS_FILE = new URL('../data/coins.json', import.meta.url);
const OUT_FILE = new URL('../data/coin-details.jsonl', import.meta.url);
const MIN_DELAY_MS = 2500;
const JITTER_MS = 2000;
const BACKOFF_MS = [60_000, 180_000, 600_000, 1_200_000];
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: 'https://coinmarketcap.com',
  Referer: 'https://coinmarketcap.com/',
};

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const limit = Number(arg('--limit')) || Infinity;
// --slug wrapped-zero-gravity: only that coin (CoinMarketCap slug, as in its page URL)
const onlySlug = arg('--slug');
// --from 501: start at that market-cap rank (with --limit 100: ranks 501-600)
const fromRank = Number(arg('--from')) || 1;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// CoinMarketCap stores links without a scheme ("//gnodi.info/") and sometimes several in one string.
const links = (list) =>
  [...new Set((list || []).flatMap((u) => String(u).split(/\s+/)).map((u) => u.trim()).filter(Boolean)
    .map((u) => (u.startsWith('//') ? `https:${u}` : /^https?:/i.test(u) ? u : `https://${u}`)))];

function toDetails(slug, d) {
  const u = d.urls || {};
  return {
    slug,
    id: d.id,
    logo: d.id ? `https://s2.coinmarketcap.com/static/img/coins/64x64/${d.id}.png` : '',
    website: links(u.website),
    socials: links([...(u.twitter || []), ...(u.chat || []), ...(u.reddit || []), ...(u.facebook || []),
      ...(u.message_board || []), ...(u.announcement || []), ...(u.source_code || [])]),
    docs: links(u.technical_doc),
    explorers: links(u.explorer),
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchDetail(coin) {
  const q = coin.id ? `id=${coin.id}` : `slug=${encodeURIComponent(coin.slug)}`;
  const res = await fetch(`https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail?${q}`, { headers: HEADERS });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, retryAfter: Number(res.headers.get('retry-after')) || 0 });
  const body = await res.json();
  if (!body.data) throw new Error(body.status?.error_message || 'no data');
  return toDetails(coin.slug, body.data);
}

async function main() {
  const { coins } = JSON.parse(await readFile(COINS_FILE, 'utf8'));
  const done = new Set(
    (await readFile(OUT_FILE, 'utf8').catch(() => '')).split('\n').filter(Boolean).map((l) => JSON.parse(l).slug),
  );
  const todo = coins
    .filter((c) => !done.has(c.slug) && (!onlySlug || c.slug === onlySlug) && (c.rank ?? Infinity) >= fromRank)
    .slice(0, limit);
  console.log(`${done.size} already fetched, ${todo.length} to go`);

  let stop = false;
  process.on('SIGINT', () => {
    console.log('\nStopping after this coin...');
    stop = true;
  });

  let fetched = 0;
  let failures = 0;
  const attempts = new Map();
  for (const coin of todo) {
    if (stop) break;
    try {
      const details = await fetchDetail(coin);
      await appendFile(OUT_FILE, `${JSON.stringify(details)}\n`);
      fetched++;
      failures = 0;
      if (fetched % 50 === 0) console.log(`${fetched}/${todo.length} (${coin.symbol})`);
    } catch (err) {
      // A coin CoinMarketCap no longer has: note it so it is not asked again.
      if (err.status === 404 || err.message === 'no data') {
        await appendFile(OUT_FILE, `${JSON.stringify({ slug: coin.slug, missing: true, fetchedAt: new Date().toISOString() })}\n`);
        continue;
      }
      if (failures >= BACKOFF_MS.length) {
        console.error(`Giving up after ${failures + 1} failures in a row (${err.message}); run again later to continue.`);
        process.exitCode = 1;
        break;
      }
      const wait = Math.max(BACKOFF_MS[failures], err.retryAfter * 1000);
      failures++;
      console.warn(`${coin.symbol}: ${err.message}, waiting ${Math.round(wait / 1000)} s`);
      attempts.set(coin.slug, (attempts.get(coin.slug) || 0) + 1);
      if (attempts.get(coin.slug) < 3) todo.push(coin); // try this one again at the end; after that, on the next run
      await sleep(wait);
      continue;
    }
    await sleep(MIN_DELAY_MS + Math.random() * JITTER_MS);
  }
  console.log(`Fetched ${fetched} coins into data/coin-details.jsonl`);
}

await main();
