// Serves the built React app and forwards /api to the API process.
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
const app = express();

app.use('/api', createProxyMiddleware({ target: `http://127.0.0.1:${config.apiPort}/api`, xfwd: true }));
app.use(express.static(dist, { index: false, maxAge: '1h' }));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(config.webPort, () => console.log(`Web on http://0.0.0.0:${config.webPort}`));
