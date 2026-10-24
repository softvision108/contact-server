# Contact server

A small MERN app for tracking outreach: a login, a **Providers** list (the casino game providers from `contacts.json`), a **People** list (the user export) and a **License** list (companies that help get a gambling licence, e.g. Anjouan or Curaçao, plus the regulators, from `License/licenses.json`) and a **Streamers** list (casino, slots and poker streamers seen live on Kick and Twitch, from `Streamers/streamers.json`). Every list has create, edit and delete, plus a `status` (ready, sent, replied, blocked) and a long `content` field.

- `server/`: Express + Mongoose API (`src/index.js`), plus a small web server (`src/web.js`) that serves the built React app and forwards `/api` to the API.
- `client/`: React 19 + Vite + Tailwind 4, styled like the lg24 admin-frontend (TailAdmin theme: Outfit font, brand blue, collapsible sidebar, sticky header, light/dark mode, its filter panel, table, badge, pager, toast and modal patterns).

## Email

Emails go out through [Resend](https://resend.com) (its HTTP API, the same sender as skystake's `vendors/resend`, in `server/src/resend.js`).

- **One row:** the envelope button in a row's Actions opens the email window for that row only.
- **Many rows:** tick rows on any list (the header box ticks the whole page; picks are kept across pages), then **Send email** in the bar above the table.

You pick a sender, write a subject and message; `{{name}}`, `{{email}}` and any field of the row (`{{username}}`, `{{country}}`...) are filled in per row. One email goes to each row (its first address, or all of them if you tick that option), one by one with the pause set in **Settings > Mail** between them, and the window shows each row's result.

After a send, every emailed row gets `lastEmailAt`, `lastEmailSubject`, `lastEmailFrom` and `emailCount` (shown as "Emailed <date>" under its status), and a row that was `ready` becomes `sent`. Rows marked `replied` keep their status, rows marked `blocked` or without an email are skipped, and a failed send is shown as "Email failed" with the reason on hover.

**Resend accounts and senders:** **Settings > Mail** holds the Resend accounts (integrations, each with its API key, stored encrypted with `MAIL_SECRET` from `server/.env`) and the senders of each account (`Name <address>` on a domain verified in that account, optional reply-to). **Test** checks a key and whether each sender's domain is verified. Two senders can send at the same time; one sender runs one send at a time.

**Daily limit:** one global number (default 100, the Resend free plan's quota; 0 stops sending), applied to each sender and also to the total of each Resend account. It counts recipient addresses per UTC day; rows past either limit are skipped, and a refused send does not count. The settings page shows today's usage per account and per sender.

The first start after this change turns the old `RESEND_API_KEY` / `RESEND_FROM` / `MAIL_REPLY_TO` / `MAIL_DELAY_MS` in `server/.env` into the first account and sender (and moves today's count to it); after that they are not read. `MAIL_DRY_RUN=true` runs the whole flow without sending anything.

## Ports

Chosen to be free on the skystake lgserver (it already uses 3000, 3001, 3003, 3333, 3334, 8081, 10000 and 27017):

| Process | Port | Listens on |
|---|---|---|
| API (`npm start`) | 4200 | 127.0.0.1 only |
| Web (`npm run web`) | 4201 | all addresses |

## Run locally

1. Copy `server/.env.example` to `server/.env` and fill it in (`JWT_SECRET`: any long random text; `SEED_ADMIN_PASSWORD`: the admin's first password).
2. Install, seed, build, start:

```bash
cd server && npm install && npm run seed
cd ../client && npm install && npm run build
cd ../server && npm start
npm run web
```

Then open http://localhost:4201. For frontend work, `npm run dev` in `client/` runs Vite on port 5180 against the API on 4200.

## Seed

`npm run seed` creates the admin user if it does not exist (it never changes an existing password), then imports:

- providers from `SEED_CONTACTS_FILE` (`contacts.json`), matched by `id`/slug
- people from `SEED_PEOPLE_DIR` (one folder per country with `enhanced.csv` and `perfect.csv`), matched by email: one row per email, and a person in `perfect.csv` gets `quality: perfect`
- licence companies from `SEED_LICENSE_FILE` (`licenses.json`, built by `License/build_licenses.py` from `License/research/*.json`), matched by slug; the file's order is the initial `order`
- streamers from `SEED_STREAMERS_FILE` (`streamers.json`), matched by platform + username. Followers, viewers, bio and title are refreshed; emails and links are only added to; a streamer missing from a newer scrape is kept (it was just offline)

You can run it again after `contacts.json` or the export changes: new rows are added, research fields are refreshed, and the `status` and `content` you set in the app are never overwritten. A provider that is no longer in `contacts.json` (merged or removed there) is deleted only if nobody worked on it in the app (status still `ready`, no content, not added by hand). People and licence companies follow the same rule. `npm run sync` is the same command under a clearer name.

Providers get an initial `order` (1 = most popular) from `server/src/popularity.js` (a hand-ranked list of the best-known brands), then by how many research sources mention them. Rows that already have an order keep it, so changes made in the app stay.

## Deploy on lgserver

1. Put the code on the server (by `git pull`, after the project is in a git repo).
2. Create `server/.env` there. `MONGO_URI` must point at the MongoDB in Docker on `127.0.0.1:27017`, with its user and password and a separate database, e.g. `mongodb://<user>:<password>@127.0.0.1:27017/contact-server?authSource=admin`. Use a new `JWT_SECRET`.
3. Copy the data the seed reads (`contacts.json`, the people folder) to the server and set the two `SEED_*` paths, then run `npm run seed`.
4. Build the client and start both processes with pm2:

```bash
pm2 start npm --name contact-api --cwd /home/contact-server/server -- start
pm2 start npm --name contact-web --cwd /home/contact-server/server -- run web
pm2 save
```

5. Reach it: either open port 4201 in the firewall, or (better: HTTPS) add an nginx site for a subdomain that proxies to `http://127.0.0.1:4201`, the same way the bigwin.dog sites proxy to 3000/3001/3003.
