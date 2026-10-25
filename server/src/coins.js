// Downloads every active coin and token CoinMarketCap ranks into data/coins.json, in market-cap order.
// Run with `npm run coins`; the crypto partner form suggests coins from this file.
import { writeFile } from 'node:fs/promises';

const PAGE = 5000;
const url = (start) =>
  `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?start=${start}&limit=${PAGE}&sortBy=market_cap&sortType=desc&convert=USD&cryptoType=all&tagType=all&audited=false`;

const coins = [];
for (let start = 1; ; start += PAGE) {
  const res = await fetch(url(start), { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`CoinMarketCap answered ${res.status}`);
  const list = (await res.json()).data.cryptoCurrencyList;
  // platform is set for tokens issued on another chain (USDT on Ethereum...)
  coins.push(...list.map((c) => ({ id: c.id, rank: c.cmcRank, symbol: c.symbol, name: c.name, slug: c.slug, platform: c.platform?.name || '' })));
  if (list.length < PAGE) break;
  await new Promise((r) => setTimeout(r, 1500));
}
coins.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

const file = new URL('../data/coins.json', import.meta.url);
await writeFile(file, JSON.stringify({ source: 'coinmarketcap.com', fetchedAt: new Date().toISOString(), coins }));
console.log(`${coins.length} coins saved to data/coins.json`);
