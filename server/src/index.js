import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { authRouter, requireAuth } from './auth.js';
import { config } from './config.js';
import { licensesRouter } from './licenses.js';
import { mailRouter } from './mail.js';
import { migrateLegacyMail } from './mailAccounts.js';
import { peopleRouter } from './people.js';
import { providersRouter } from './providers.js';
import { streamersRouter } from './streamers.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: mongoose.connection.readyState === 1 }));
app.use('/api/auth', authRouter);
app.use('/api/providers', requireAuth, providersRouter);
app.use('/api/people', requireAuth, peopleRouter);
app.use('/api/licenses', requireAuth, licensesRouter);
app.use('/api/streamers', requireAuth, streamersRouter);
app.use('/api/mail', requireAuth, mailRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  if (err.code === 11000) return res.status(409).json({ error: 'This record is already in the list' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
});

await mongoose.connect(config.mongoUri);
await migrateLegacyMail();
app.listen(config.apiPort, '127.0.0.1', () => console.log(`API on http://127.0.0.1:${config.apiPort}`));
