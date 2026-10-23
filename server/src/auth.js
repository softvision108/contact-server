import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { User } from './models.js';

const TOKEN_TTL = '12h';

function signToken(user) {
  return jwt.sign({ sub: String(user._id), v: user.tokenVersion }, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.v) throw new Error('stale token');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again' });
  }
}

export const authRouter = Router();

const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

authRouter.post('/login', loginLimiter, async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = username ? await User.findOne({ username }) : null;
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  res.json({ token: signToken(user), user: { username: user.username } });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: { username: req.user.username } });
});

authRouter.post('/change-password', requireAuth, async (req, res) => {
  const current = String(req.body?.currentPassword || '');
  const next = String(req.body?.newPassword || '');
  if (!(await bcrypt.compare(current, req.user.passwordHash))) {
    return res.status(400).json({ error: 'Current password is wrong' });
  }
  if (next.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  if (next === current) return res.status(400).json({ error: 'New password must be different' });
  req.user.passwordHash = await bcrypt.hash(next, 12);
  req.user.tokenVersion += 1;
  await req.user.save();
  res.json({ token: signToken(req.user) });
});
