// Off Pitch Africa — admin dashboard backend.
// Deploy target: Vercel (zero-config — any file in /api becomes an endpoint).
//
// What this does: lets Bonphace (or whoever has the password) update the
// site's Events / Gallery / Blog / Videos content from a browser dashboard
// (admin.html) instead of editing code. Every save is a real commit to the
// GitHub repo via GitHub's REST API — Vercel then auto-deploys it, same as
// any other push. There is no database; the JSON files in /data ARE the
// database, version-controlled like everything else in this project.
//
// REQUIRED ENVIRONMENT VARIABLES (set in Vercel dashboard, never in code):
//   ADMIN_PASSWORD        — the password used to log into /admin.html
//   ADMIN_SESSION_SECRET   — any long random string, used to sign session
//                             cookies (e.g. generate with `openssl rand -hex 32`)
//   GITHUB_TOKEN            — a fine-grained GitHub Personal Access Token
//                             scoped ONLY to this repo, with "Contents:
//                             Read and write" permission. Nothing else.
//
// SECURITY NOTES (see SECURITY.md for the full picture):
// - CORS is restricted to this site's own origin(s), same as api/chat.js.
// - Sessions are HMAC-signed cookies (HttpOnly, Secure, SameSite=Strict) —
//   no session data is trusted unless its signature checks out.
// - Login attempts are rate-limited per IP (best-effort, in-memory — same
//   caveat as chat.js: resets on cold start, see SECURITY.md).
// - All writes go through basic shape/length validation before ever being
//   committed — see validateContent() below.
// - GITHUB_TOKEN never reaches the browser; every GitHub API call happens
//   server-side only.

import crypto from 'crypto';

const ALLOWED_ORIGINS = [
  'https://offpitchafrica.com'
];

const GITHUB_OWNER = 'Geoduor';
const GITHUB_REPO = 'OFF-PITCH';
const GITHUB_BRANCH = 'main';
const GITHUB_API = 'https://api.github.com';

const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_CONTENT_BYTES = 200 * 1000; // 200 KB cap on any single JSON data file
const MAX_IMAGE_BYTES = 950 * 1000; // ~950 KB cap on uploaded images (base64 decoded)

const DATA_FILES = {
  events: 'data/events.json',
  gallery: 'data/gallery.json',
  blog: 'data/blog.json',
  videos: 'data/videos.json',
  fixtures: 'data/fixtures.json',
  live: 'data/live.json'
};

/* ---------------- Rate limiting ----------------
   Uses Upstash Redis (REST) when UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
   are set, so the limit is shared across every serverless instance and survives
   cold starts. Without them it falls back to a best-effort in-memory limit
   (per instance only) — see SECURITY.md. */
async function upstashHit(key, windowSec) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCR', key], ['EXPIRE', key, String(windowSec), 'NX']])
    });
    if (!r.ok) return null;
    const out = await r.json();
    const n = Number(out && out[0] && out[0].result);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null; // fall back to the in-memory limit rather than failing the request
  }
}

const RATE_LIMIT = 5;                       // login attempts…
const RATE_WINDOW_MS = 10 * 60 * 1000;      // …per IP per 10 minutes
const loginAttempts = new Map();

async function isRateLimited(ip) {
  const shared = await upstashHit(`opa:login:${ip}`, RATE_WINDOW_MS / 1000);
  if (shared !== null) return shared > RATE_LIMIT;
  const now = Date.now();
  const timestamps = (loginAttempts.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  loginAttempts.set(ip, timestamps);
  if (loginAttempts.size > 5000) loginAttempts.clear();
  return timestamps.length > RATE_LIMIT;
}

/* ---------------- CORS ---------------- */
function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/* ---------------- Session cookie (HMAC-signed, no dependencies) ---------------- */
function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64').toString('utf8');
}

function sign(payload) {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Fingerprint of the current admin password. Stored in the signed session, so
// changing ADMIN_PASSWORD immediately invalidates every existing session.
function passwordFingerprint() {
  return crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || '').digest('hex').slice(0, 16);
}

function createSessionToken() {
  const payload = base64url(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS, pw: passwordFingerprint() }));
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifySessionToken(token) {
  // Fail closed if the signing secret was never configured: with an empty
  // secret every token would share the same predictable signature and an
  // attacker could forge a valid session without the password.
  if (!process.env.ADMIN_SESSION_SECRET) return false;
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature || '', 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const data = JSON.parse(base64urlDecode(payload));
    return typeof data.exp === 'number' && data.exp > Date.now() && data.pw === passwordFingerprint();
  } catch {
    return false;
  }
}

function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  const parts = header.split(';').map(p => p.trim());
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx) === name) return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
}

function setSessionCookie(res, token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  res.setHeader('Set-Cookie', `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
}

function requireSession(req) {
  const token = getCookie(req, 'admin_session');
  return verifySessionToken(token);
}

/* ---------------- GitHub REST API helpers ---------------- */
function githubHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'off-pitch-admin-dashboard'
  };
}

async function githubGetFile(path) {
  const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (res.status === 404) return { content: null, sha: null };
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const data = await res.json();
  const decoded = Buffer.from(data.content, 'base64').toString('utf8');
  return { content: decoded, sha: data.sha };
}

async function githubPutFile(path, contentString, sha, message) {
  const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  const body = {
    message,
    content: Buffer.from(contentString, 'utf8').toString('base64'),
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('GitHub PUT failed:', res.status, errText);
    throw new Error(`GitHub PUT failed: ${res.status}`);
  }
  return res.json();
}

/* ---------------- Content validation ----------------
   Keeps obviously-broken or oversized payloads from ever being committed.
   Deliberately simple: length caps + required-field checks per type,
   not a full schema validator. */
function isNonEmptyString(v, maxLen) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= maxLen;
}
function isOptionalString(v, maxLen) {
  return v === undefined || v === '' || (typeof v === 'string' && v.length <= maxLen);
}
// Links must be https:// (external) or a plain site-relative path. Anything
// else — javascript:, data:, protocol-relative //host, path traversal — is rejected.
function isSafeLink(v, maxLen, { allowRelative = false } = {}) {
  if (v === undefined || v === '') return true;
  if (typeof v !== 'string' || v.length > maxLen || /[\u0000-\u001f\\]/.test(v)) return false;
  if (allowRelative && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v) && !v.startsWith('//') && !v.split('/').includes('..')) return true;
  try { return new URL(v).protocol === 'https:'; } catch { return false; }
}
// Image/video paths: a site-relative asset path or an https:// URL.
const isSafeAsset = (v, maxLen) => isSafeLink(v, maxLen, { allowRelative: true });
function isOptionalNumber(v, max) {
  return v === undefined || v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max);
}

// Blog post body: an optional list of plain-text paragraphs.
function isOptionalBody(v) {
  if (v === undefined || v === null) return true;
  return Array.isArray(v) && v.length <= 60 &&
    v.every(p => typeof p === 'string' && p.length <= 4000);
}
// Blog post links: an optional list of {label, url} pairs.
function isOptionalLinks(v) {
  if (v === undefined || v === null) return true;
  return Array.isArray(v) && v.length <= 12 && v.every(l =>
    l && typeof l === 'object' && !Array.isArray(l) &&
    isNonEmptyString(l.label, 80) && isNonEmptyString(l.url, 500) && isSafeLink(l.url, 500)
  );
}

function validateContent(type, content) {
  if (JSON.stringify(content).length > MAX_CONTENT_BYTES) {
    return 'Content is too large.';
  }

  if (type === 'live') {
    if (!content || typeof content !== 'object' || Array.isArray(content)) return 'Live status must be an object.';
    const okActive = typeof content.active === 'boolean';
    const okPlatform = isOptionalString(content.platform, 40);
    const okUrl = isSafeLink(content.url, 500);
    const okLabel = isOptionalString(content.label, 200);
    if (!okActive || !okPlatform || !okUrl || !okLabel) return 'Live status has invalid fields.';
    if (content.active && !content.url) return 'A URL is required when Live is turned on.';
    return null;
  }

  if (!Array.isArray(content)) return 'Content must be a list.';
  if (content.length > 200) return 'Too many items (max 200).';

  const validators = {
    events: item =>
      isNonEmptyString(item.id, 100) &&
      isNonEmptyString(item.title, 160) &&
      isNonEmptyString(item.date, 80) &&
      isOptionalString(item.theme, 200) &&
      isOptionalString(item.time, 80) &&
      isOptionalString(item.venue, 200) &&
      isSafeAsset(item.image, 300) &&
      isSafeAsset(item.video, 300) &&
      isSafeAsset(item.videoPoster, 300) &&
      isSafeLink(item.registerLink, 500) &&
      isOptionalString(item.phone, 40) &&
      isOptionalString(item.email, 120) &&
      (item.spotlight === undefined || typeof item.spotlight === 'boolean') &&
      typeof item.active === 'boolean',
    gallery: item =>
      isNonEmptyString(item.id, 100) &&
      isNonEmptyString(item.src, 300) && isSafeAsset(item.src, 300) &&
      isOptionalString(item.alt, 200) &&
      isOptionalString(item.category, 40) &&
      isOptionalNumber(item.width, 20000) &&
      isOptionalNumber(item.height, 20000) &&
      isOptionalString(item.caption, 300) &&
      isSafeLink(item.link, 500),
    blog: item =>
      isNonEmptyString(item.id, 100) &&
      isNonEmptyString(item.title, 200) &&
      isSafeLink(item.url, 500) &&
      isOptionalString(item.date, 100) &&
      isOptionalString(item.excerpt, 600) &&
      isSafeAsset(item.image, 300) &&
      isOptionalBody(item.body) &&
      isOptionalLinks(item.links) &&
      // A post must be readable somewhere: either in full on the site (body)
      // or via an external URL (e.g. the Substack edition).
      ((typeof item.url === 'string' && item.url.trim().length > 0) ||
        (Array.isArray(item.body) && item.body.some(p => typeof p === 'string' && p.trim().length > 0))),
    videos: item =>
      isNonEmptyString(item.id, 100) &&
      isNonEmptyString(item.youtubeId, 30) && /^[A-Za-z0-9_-]{6,30}$/.test(item.youtubeId) &&
      isOptionalString(item.title, 200),
    fixtures: item =>
      isNonEmptyString(item.id, 100) &&
      isOptionalString(item.competition, 160) &&
      ['Men', 'Women'].includes(item.category) &&
      isOptionalString(item.stage, 80) &&
      isNonEmptyString(item.date, 60) &&
      isOptionalString(item.time, 40) &&
      isNonEmptyString(item.team1, 60) &&
      isNonEmptyString(item.team2, 60) &&
      isOptionalString(item.score1, 10) &&
      isOptionalString(item.score2, 10) &&
      isOptionalString(item.venue, 100) &&
      ['upcoming', 'live', 'final'].includes(item.status)
  };

  const validator = validators[type];
  if (!validator) return 'Unknown content type.';
  for (const item of content) {
    if (!item || typeof item !== 'object' || !validator(item)) {
      return 'One or more items are missing required fields or are too long.';
    }
  }
  return null;
}

/* ---------------- Field allowlists ----------------
   validateContent() checks the fields it knows about; this strips everything
   else so unexpected keys can never be written into the data files. */
const ALLOWED_FIELDS = {
  events: ['id', 'title', 'theme', 'date', 'time', 'venue', 'image', 'video', 'videoPoster', 'registerLink', 'phone', 'email', 'spotlight', 'active'],
  gallery: ['id', 'src', 'alt', 'category', 'width', 'height', 'caption', 'link'],
  blog: ['id', 'title', 'url', 'date', 'excerpt', 'image', 'body', 'links'],
  videos: ['id', 'youtubeId', 'title'],
  fixtures: ['id', 'competition', 'category', 'stage', 'date', 'time', 'team1', 'team2', 'score1', 'score2', 'venue', 'status'],
  live: ['active', 'platform', 'url', 'label']
};
function pickAllowed(type, content) {
  const keys = ALLOWED_FIELDS[type];
  const pick = obj => Object.fromEntries(Object.entries(obj).filter(([k]) => keys.includes(k)));
  if (type === 'live') return pick(content);
  const out = content.map(pick);
  if (type === 'blog') {
    out.forEach(p => { if (Array.isArray(p.links)) p.links = p.links.map(l => ({ label: l.label, url: l.url })); });
  }
  return out;
}

/* ---------------- Handler ---------------- */
export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';

  let action = req.query && req.query.action;
  let body = {};
  if (req.method === 'POST') {
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch {
      res.status(400).json({ error: 'Invalid JSON body.' });
      return;
    }
    action = action || body.action;
  }

  if (!action) {
    res.status(400).json({ error: 'Missing action.' });
    return;
  }

  try {
    /* ---- LOGIN ---- */
    if (action === 'login' && req.method === 'POST') {
      if (await isRateLimited(ip)) {
        res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.' });
        return;
      }
      if (!process.env.ADMIN_SESSION_SECRET) {
        res.status(500).json({ error: 'Dashboard is not fully configured: ADMIN_SESSION_SECRET is missing. See README.md section 7.' });
        return;
      }
      const password = body.password;
      const expected = process.env.ADMIN_PASSWORD || '';
      const ok =
        typeof password === 'string' &&
        expected.length > 0 &&
        password.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected));
      if (!ok) {
        await new Promise(r => setTimeout(r, 500)); // slow down guessing
        res.status(401).json({ error: 'Incorrect password.' });
        return;
      }
      setSessionCookie(res, createSessionToken());
      res.status(200).json({ ok: true });
      return;
    }

    /* ---- LOGOUT ---- */
    if (action === 'logout' && req.method === 'POST') {
      clearSessionCookie(res);
      res.status(200).json({ ok: true });
      return;
    }

    /* ---- CHECK SESSION ---- */
    if (action === 'check' && req.method === 'GET') {
      res.status(200).json({ loggedIn: requireSession(req) });
      return;
    }

    // Everything below requires a valid session.
    if (!requireSession(req)) {
      res.status(401).json({ error: 'Not logged in.' });
      return;
    }

    /* ---- GET CONTENT ---- */
    if (action === 'get' && req.method === 'GET') {
      const type = req.query.type;
      const path = DATA_FILES[type];
      if (!path) {
        res.status(400).json({ error: 'Unknown content type.' });
        return;
      }
      const { content } = await githubGetFile(path);
      const fallback = type === 'live' ? { active: false, platform: '', url: '', label: '' } : [];
      res.status(200).json({ content: content ? JSON.parse(content) : fallback });
      return;
    }

    /* ---- SAVE CONTENT ---- */
    if (action === 'save' && req.method === 'POST') {
      const { type, content } = body;
      const path = DATA_FILES[type];
      if (!path) {
        res.status(400).json({ error: 'Unknown content type.' });
        return;
      }
      const validationError = validateContent(type, content);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      const { sha } = await githubGetFile(path); // fetch latest sha right before writing
      const pretty = JSON.stringify(pickAllowed(type, content), null, 2) + '\n';
      await githubPutFile(path, pretty, sha, `admin: update ${type}`);
      res.status(200).json({ ok: true });
      return;
    }

    /* ---- UPLOAD IMAGE ---- */
    if (action === 'uploadImage' && req.method === 'POST') {
      const { filename, base64 } = body;
      if (!isNonEmptyString(filename, 120) || !/^[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/i.test(filename)) {
        res.status(400).json({ error: 'Invalid filename. Use only letters, numbers, - and _, ending in .webp/.jpg/.jpeg/.png.' });
        return;
      }
      if (typeof base64 !== 'string' || base64.length === 0) {
        res.status(400).json({ error: 'Missing image data.' });
        return;
      }
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
        res.status(400).json({ error: 'Image data is not valid base64.' });
        return;
      }
      const head = Buffer.from(base64.slice(0, 32), 'base64');
      const isPng = head.length >= 4 && head.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const isJpg = head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
      const isWebp = head.length >= 12 && head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
      if (!isPng && !isJpg && !isWebp) {
        res.status(400).json({ error: 'That file is not a valid PNG, JPG or WebP image.' });
        return;
      }
      const decodedSize = Math.floor(base64.length * 0.75);
      if (decodedSize > MAX_IMAGE_BYTES) {
        res.status(400).json({ error: 'Image too large (max ~950KB after compression).' });
        return;
      }
      const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9_.-]/g, '')}`;
      const path = `assets/img/uploads/${safeName}`;
      const url = `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
      const ghRes = await fetch(url, {
        method: 'PUT',
        headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `admin: upload image ${safeName}`,
          content: base64,
          branch: GITHUB_BRANCH
        })
      });
      if (!ghRes.ok) {
        const errText = await ghRes.text().catch(() => '');
        console.error('GitHub image upload failed:', ghRes.status, errText);
        res.status(502).json({ error: 'Upload failed. Please try again.' });
        return;
      }
      res.status(200).json({ ok: true, path });
      return;
    }

    res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('Admin API error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
