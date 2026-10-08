const express = require('express');
const crypto = require('crypto');
const { promisify } = require('util');
const db = require('../database/init');
const { sendMagicLink } = require('../services/mailer');

const router = express.Router();
const scrypt = promisify(crypto.scrypt);

const SCRYPT_OPTS = { N: 2 ** 15, maxmem: 64 * 1024 * 1024 };
const SESSION_DAYS = 30;
const LINK_TTL_MINUTES = 15;
// Magic links point here; never derive it from request headers (lets an attacker redirect the link)
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const USERNAME_RE = /^[A-Za-z0-9_.]{3,32}$/;
const SETTINGS = { language: ['en', 'bs'], theme: ['system', 'light', 'dark'] };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Keep in sync with frontend/src/pages/Auth.jsx
const PASSWORD_RULES = [
  [/.{8,}/, 'at least 8 characters'],
  [/[A-Z]/, 'an uppercase letter'],
  [/[0-9]/, 'a number'],
  [/[^A-Za-z0-9]/, 'a special character']
];

const passwordProblems = (password) =>
  PASSWORD_RULES.filter(([re]) => !re.test(password)).map(([, label]) => label);

const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64, SCRYPT_OPTS);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
};

const verifyPassword = async (password, stored) => {
  const [salt, hash] = stored.split(':');
  const candidate = await scrypt(password, Buffer.from(salt, 'hex'), 64, SCRYPT_OPTS);
  return crypto.timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
};

// Compared against when the account doesn't exist, so response time doesn't reveal it
const dummyHash = hashPassword(crypto.randomUUID());

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readToken = (req) => req.headers.cookie?.match(/(?:^|;\s*)sid=([^;]+)/)?.[1];
const publicUser = ({ id, username, identifier, email, language, theme }) => ({ id, username, identifier, email, language, theme });
const maskEmail = (email) => email.replace(/^(.)[^@]*/, '$1***');

// Known language/theme values from a request body; anything else keeps the fallback's value
const pickSettings = (body, fallback) => Object.fromEntries(Object.entries(SETTINGS)
  .map(([key, allowed]) => [key, allowed.includes(body[key]) ? body[key] : fallback[key]]));

// Email confirmation: a single-use link; opening it (POST /verify) confirms the email and starts a session
const issueLink = async (client, user) => {
  const token = crypto.randomBytes(32).toString('base64url');
  await client.query('DELETE FROM login_tokens WHERE expires_at < now()');
  await client.query(
    `INSERT INTO login_tokens (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [sha256(token), user.id, LINK_TTL_MINUTES]
  );
  await sendMagicLink(user.email, {
    username: user.username,
    link: `${APP_URL}/verify?token=${token}`,
    ttlMinutes: LINK_TTL_MINUTES
  }).catch((error) => {
    console.error('Sending magic link failed:', error);
    throw Object.assign(new Error("Couldn't send the email. Please try again in a moment."), { status: 503 });
  });
};

const startSession = async (req, res, userId) => {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.run('DELETE FROM sessions WHERE expires_at < now()');
  await db.run(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`,
    [sha256(token), userId, SESSION_DAYS]
  );
  res.cookie('sid', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
  });
};

const requireAuth = async (req, res, next) => {
  try {
    const token = readToken(req);
    const user = token && await db.one(`
      SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()
    `, [sha256(token)]);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    req.user = publicUser(user);
    next();
  } catch (error) {
    next(error);
  }
};

// ponytail: in-memory per-process lockout keyed by IP; move to the DB if the app ever runs as multiple instances
const MAX_FAILURES = 10;
const LOCKOUT_MS = 15 * 60 * 1000;
const failures = new Map();

// POST register
router.post('/register', async (req, res, next) => {
  try {
    const username = String(req.body.username ?? '').trim();
    const email = String(req.body.email ?? '').trim();
    const password = String(req.body.password ?? '');

    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-32 characters: letters, numbers, _ or .' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    const problems = passwordProblems(password);
    if (problems.length) {
      return res.status(400).json({ error: `Password needs ${problems.join(', ')}` });
    }

    const { language, theme } = pickSettings(req.body, { language: 'en', theme: 'system' });
    const passwordHash = await hashPassword(password);
    try {
      // If the email can't be sent, the account isn't created either
      await db.tx(async (client) => {
        const { rows: [user] } = await client.query(`
          INSERT INTO users (username, identifier, email, password_hash, language, theme)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [username, crypto.randomInt(10000).toString().padStart(4, '0'), email, passwordHash, language, theme]);
        await issueLink(client, user);
      });
    } catch (error) {
      if (error.code === '23505') {
        const field = error.constraint === 'users_email_key' ? 'Email' : 'Username';
        return res.status(409).json({ error: `${field} is already taken` });
      }
      throw error;
    }

    res.status(201).json({ email: maskEmail(email) });
  } catch (error) {
    next(error);
  }
});

// POST login with username or email
router.post('/login', async (req, res, next) => {
  try {
    const now = Date.now();
    const attempts = failures.get(req.ip);
    if (attempts?.until > now && attempts.count >= MAX_FAILURES) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    }

    const login = String(req.body.login ?? '').trim();
    const password = String(req.body.password ?? '');

    const user = login && await db.one(
      'SELECT * FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($1)',
      [login]
    );
    const valid = await verifyPassword(password, user ? user.password_hash : await dummyHash);

    if (!user || !valid) {
      failures.set(req.ip, { count: attempts?.until > now ? attempts.count + 1 : 1, until: now + LOCKOUT_MS });
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    failures.delete(req.ip);
    if (!user.email_verified) {
      // Confirmation link never opened (or expired): send a fresh one instead of signing in
      await issueLink(db.pool, user);
      return res.status(202).json({ email: maskEmail(user.email) });
    }
    await startSession(req, res, user.id);
    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
});

// POST verify email confirmation link -> start session
router.post('/verify', async (req, res, next) => {
  try {
    const user = await db.one(`
      WITH used AS (
        DELETE FROM login_tokens WHERE token_hash = $1 AND expires_at > now() RETURNING user_id
      )
      UPDATE users u SET email_verified = true FROM used WHERE u.id = used.user_id RETURNING u.*
    `, [sha256(String(req.body.token ?? ''))]);
    if (!user) {
      return res.status(400).json({ error: 'This link is invalid or has expired. Sign in again to get a new one.' });
    }

    await startSession(req, res, user.id);
    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
});

// POST logout
router.post('/logout', async (req, res, next) => {
  try {
    const token = readToken(req);
    if (token) {
      await db.run('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
    }
    res.clearCookie('sid');
    res.json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
});

// GET current user
router.get('/me', requireAuth, (req, res) => res.json(req.user));

// PATCH settings (language, theme)
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { language, theme } = pickSettings(req.body, req.user);
    const user = await db.one('UPDATE users SET language = $1, theme = $2 WHERE id = $3 RETURNING *', [language, theme, req.user.id]);
    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
});

module.exports = { router, requireAuth, passwordProblems, pickSettings };
