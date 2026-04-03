const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const Url = require('./models/Url');
const Counter = require('./models/Counter');
const User = require('./models/User');
const auth = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/urlshortener';
const JWT_SECRET = process.env.JWT_SECRET;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const MONGODB_TIMEOUT_MS = Number(process.env.MONGODB_TIMEOUT_MS || 5000);
const NODE_ENV = process.env.NODE_ENV || 'development';
const TOKEN_COOKIE_NAME = 'token';
const TOKEN_LIFETIME_SECONDS = 60 * 60 * 12;
const TOKEN_LIFETIME_MS = TOKEN_LIFETIME_SECONDS * 1000;
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000'];
const CUSTOM_ALIAS_REGEX = /^[A-Za-z0-9_-]{3,32}$/;
const RESERVED_ALIASES = new Set([
  'api',
  'auth',
  'dashboard',
  'health',
  'login',
  'logout',
  'myurls',
  'register'
]);

let isDatabaseConnected = false;
const rateLimitStore = new Map();

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Add it to backend/.env before starting the server.');
}

function normalizeOrigin(value) {
  return value.trim().replace(/\/+$/, '');
}

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((value) => normalizeOrigin(value))
  .filter(Boolean);

const corsOrigins = allowedOrigins.length > 0 ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS;

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (corsOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));

app.use((error, req, res, next) => {
  if (error && error.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed by CORS' });
  }

  return next(error);
});

mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: MONGODB_TIMEOUT_MS })
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.log('MongoDB Connection Error:', err));

mongoose.connection.on('connected', () => {
  isDatabaseConnected = true;
});

mongoose.connection.on('disconnected', () => {
  isDatabaseConnected = false;
});

mongoose.connection.on('error', () => {
  isDatabaseConnected = false;
});

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const BASE = ALPHABET.length;

function getClientIdentifier(req) {
  return req.ip || req.connection.remoteAddress || 'unknown';
}

function cleanupRateLimitStore(now) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

function createRateLimiter({ windowMs, maxRequests, message }) {
  return (req, res, next) => {
    const now = Date.now();
    cleanupRateLimitStore(now);

    const key = `${req.path}:${getClientIdentifier(req)}`;
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt <= now) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: message });
    }

    entry.count += 1;
    return next();
  };
}

function encodeId(num) {
  if (num === 0) return ALPHABET[0];
  let str = '';
  while (num > 0) {
    str = ALPHABET[num % BASE] + str;
    num = Math.floor(num / BASE);
  }
  return str;
}

function createAuthToken(userId) {
  const payload = { user: { id: userId } };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_LIFETIME_SECONDS });
}

function setAuthCookie(res, token) {
  res.cookie(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
    secure: NODE_ENV === 'production',
    maxAge: TOKEN_LIFETIME_MS
  });
}

function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
    secure: NODE_ENV === 'production'
  });
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

function isValidCustomAlias(value) {
  if (!CUSTOM_ALIAS_REGEX.test(value)) {
    return false;
  }

  return !RESERVED_ALIASES.has(value.toLowerCase());
}

function requireDatabase(req, res, next) {
  if (isDatabaseConnected) {
    return next();
  }

  return res.status(503).json({
    error: 'Database is not connected. Start MongoDB locally and try again.'
  });
}

const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many authentication attempts. Please try again later.'
});

const shortenRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
  message: 'Too many shorten requests. Please slow down and try again shortly.'
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: isDatabaseConnected ? 'connected' : 'disconnected'
  });
});

app.get('/api/auth/me', auth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ authenticated: false });
  }

  return res.json({ authenticated: true, user: req.user });
});

app.post('/api/auth/register', authRateLimiter, requireDatabase, async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Email and a password of at least 8 characters are required' });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ error: 'User already exists' });

    user = new User({ email, password });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const token = createAuthToken(user.id);
    setAuthCookie(res, token);
    res.json({
      authenticated: true,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', authRateLimiter, requireDatabase, async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid Credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid Credentials' });

    const token = createAuthToken(user.id);
    setAuthCookie(res, token);
    res.json({
      authenticated: true,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// --- Updated URL Shortening Route (Enforced Auth) ---
app.post('/api/shorten', auth, requireDatabase, shortenRateLimiter, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'You must be logged in to shorten URLs' });
  }

  const { longUrl, customAlias } = req.body;
  if (!longUrl) return res.status(400).json({ error: 'Long URL is required' });

  if (!isValidHttpUrl(longUrl)) {
    return res.status(400).json({ error: 'Only valid http and https URLs are allowed' });
  }

  try {
    let shortCode = customAlias ? customAlias.trim() : '';
    if (customAlias) {
      if (!isValidCustomAlias(shortCode)) {
        return res.status(400).json({
          error: 'Custom alias must be 3-32 characters and use only letters, numbers, underscores, or hyphens'
        });
      }

      const existing = await Url.findOne({ shortCode });
      if (existing) return res.status(400).json({ error: 'Alias already in use' });
    } else {
      const counter = await Counter.findByIdAndUpdate(
        'url_count',
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      shortCode = encodeId(counter.seq).padStart(7, '0');
    }

    const newUrl = new Url({
      longUrl,
      shortCode,
      shortUrl: `${BASE_URL}/${shortCode}`,
      userId: req.user.id
    });
    await newUrl.save();

    res.json({ longUrl, shortUrl: `${BASE_URL}/${shortCode}`, shortCode });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/myurls', auth, requireDatabase, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const urls = await Url.find({ userId: req.user.id }).sort({ date: -1 });
    res.json(urls);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/:shortCode', requireDatabase, async (req, res) => {
  try {
    const url = await Url.findOne({ shortCode: req.params.shortCode });
    if (url) {
      if (!isValidHttpUrl(url.longUrl)) {
        return res.status(400).json({ error: 'Stored URL is invalid' });
      }

      url.clicks += 1;
      await url.save();
      return res.redirect(url.longUrl);
    }
    return res.status(404).send('<h1>404 - URL Not Found</h1>');
  } catch (error) {
    res.status(500).json('Server error');
  }
});


app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
