# contact-server

Outreach admin: `server/` (Express + MongoDB API) and `client/` (React + Vite admin UI).
Lists: Providers, People, Streamers, License, Crypto Partner. Each has a CRUD router in `server/src/` and a page + modal in `client/src/pages/`.

## Crypto Partner coin pipeline

The crypto partner table (`CryptoPartner`, collection `cryptopartners`) holds every coin CoinMarketCap ranks, as type `coin-project`.
All commands run in `server/`. Only `coins:import` needs the database (`server/.env`); the other steps only write files in `server/data/`, so they can run on any machine (a Claude cloud session) and the files come back via git.

| Step | Command | Writes |
| --- | --- | --- |
| 1. Coin list (rank, symbol, name, CMC id) | `npm run coins` | `data/coins.json` |
| 2. Links from each coin page (website, socials, whitepaper, explorers, logo) | `npm run coins:details -- --from <rank> --limit <n>` | appends `data/coin-details.jsonl` |
| 3. Emails from the coins' own websites | `npm run coins:emails` (every coin in step 2 not checked yet) | appends `data/coin-emails.jsonl` |
| 4. Apply all of it to the table | `npm run coins:import` | MongoDB (local, on the user's PC) |

Rules:
- Steps 2 and 3 are resumable: coins already in the `.jsonl` files are skipped, so never delete those files. Commit them after every batch.
- Do **not** re-run step 1 between batches: it re-ranks the coins, so "ranks 501-600" would mean different coins. The ranks below refer to the `data/coins.json` snapshot fetched 2026-10-25T15:29:53Z.
- Scraping is polite on purpose (one request at a time, 2.5-4.5 s apart on CoinMarketCap, backoff on 403/429). Don't speed it up or add proxies.
- The user wants batch jobs run in a Claude cloud session, not on their PC; then `git pull` + `npm run coins:import` on the PC.

## Progress log (CMC rank ranges done)

Add a row after each batch. Check this before starting one, so no range is fetched twice.

| Ranks | Details | Emails found | Date | Where |
| --- | --- | --- | --- | --- |
| 8100 (Wrapped 0G, test) | 1/1 | 1 coin (contact@0g.ai + 4 legal/privacy) | 2026-10-25 | user's PC |
