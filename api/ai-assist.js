// Off Pitch Africa — AI content-assist for the admin dashboard.
//
// Powers the "✨ Suggest" buttons next to image/text fields in admin.html:
// draft alt text, suggest a gallery category, draft a short blog excerpt.
// Every suggestion lands in the form field as an editable draft — nothing
// is ever saved automatically. The existing "Save Changes" button in each
// dashboard panel remains the only way content actually goes live, so
// human review is guaranteed by the existing structure, not bolted on here.
//
// Reuses the same ANTHROPIC_API_KEY as api/chat.js — no separate billing
// setup needed, but it IS the same billing: this feature is inactive until
// that key has usable credit, exactly like the chat widget (see AGENT.md §10).
//
// Auth: requires the same admin session cookie as api/admin.js. The small
// verify-session helper below is intentionally duplicated rather than
// imported — every file in /api is self-contained in this project (see
// api/chat.js, api/admin.js), so this follows the existing convention.

import crypto from 'crypto';

const ALLOWED_ORIGINS = [
  'https://offpitchafrica.com',
  'https://www.offpitchafrica.com',
  'https://off-pitch-nine.vercel.app'
];

// Used to fetch already-saved images (for suggesting alt text/category on
// existing gallery photos, not just freshly-uploaded ones).
const SITE_ORIGIN = 'https://offpitchafrica.com';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Anthropic's own per-image cap
const GALLERY_CATEGORIES = ['hockey', 'community', 'celebration'];

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;
const requestLog = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  if (requestLog.size > 5000) requestLog.clear();
  return timestamps.length > RATE_LIMIT;
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/* ---- Session verification (mirrors api/admin.js) ---- */
function base64urlDecode(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64').toString('utf8');
}
function sign(payload) {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature || '', 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const data = JSON.parse(base64urlDecode(payload));
    return typeof data.exp === 'number' && data.exp > Date.now();
  } catch {
    return false;
  }
}
function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';').map(p => p.trim())) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx) === name) return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
}
function requireSession(req) {
  return verifySessionToken(getCookie(req, 'admin_session'));
}

/* ---- Fetch an already-saved image from the live site and base64-encode it ---- */
async function fetchImageAsBase64(relativePath) {
  const cleanPath = relativePath.replace(/^\/+/, '');
  const url = `${SITE_ORIGIN}/${cleanPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch existing image (${res.status}).`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error('Existing image is too large to analyze.');
  return { base64: buf.toString('base64'), mediaType: contentType };
}

/* ---- Anthropic call helper ---- */
async function askClaude({ system, content, maxTokens }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }]
    })
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('Anthropic API error (ai-assist):', response.status, errText);
    throw new Error('The AI assistant is temporarily unavailable. Please try again shortly.');
  }
  const data = await response.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  return textBlock ? textBlock.text.trim() : '';
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }

  if (!requireSession(req)) {
    return res.status(401).json({ error: 'Not logged in.' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString().split(',')[0].trim();
  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ai-assist called but ANTHROPIC_API_KEY is not set.');
    return res.status(500).json({ error: 'AI assist is not configured yet — same setup step as the chat widget (see AGENT.md).' });
  }

  const { action } = req.body || {};

  try {
    /* ---- Suggest alt text for a photo ---- */
    if (action === 'altText') {
      const { imageBase64, imageMediaType, imagePath } = req.body;
      let base64 = imageBase64;
      let mediaType = imageMediaType || 'image/jpeg';
      if (!base64 && imagePath) {
        const fetched = await fetchImageAsBase64(imagePath);
        base64 = fetched.base64;
        mediaType = fetched.mediaType;
      }
      if (!base64) return res.status(400).json({ error: 'No image provided.' });

      const suggestion = await askClaude({
        system: 'You write concise, accurate, descriptive alt text for website photos, for a Kenyan sports media company called Off Pitch Africa. Describe only what is visibly in the image — people, setting, action, visible text/logos. Never invent names, event names, or context you cannot see. One sentence, under 20 words. Respond with only the alt text, nothing else.',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Write alt text for this photo.' }
        ],
        maxTokens: 100
      });
      return res.status(200).json({ suggestion });
    }

    /* ---- Suggest a gallery category ---- */
    if (action === 'category') {
      const { imageBase64, imageMediaType, imagePath } = req.body;
      let base64 = imageBase64;
      let mediaType = imageMediaType || 'image/jpeg';
      if (!base64 && imagePath) {
        const fetched = await fetchImageAsBase64(imagePath);
        base64 = fetched.base64;
        mediaType = fetched.mediaType;
      }
      if (!base64) return res.status(400).json({ error: 'No image provided.' });

      const raw = await askClaude({
        system: `Classify this photo into exactly one of these categories: ${GALLERY_CATEGORIES.join(', ')}. "hockey" = active hockey gameplay/match action. "celebration" = trophies, wins, award moments, giftbags/partner handovers. "community" = anything else (studio shots, banners, team/group photos, merchandise). Respond with only the single category word, nothing else.`,
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Which category?' }
        ],
        maxTokens: 10
      });
      const category = GALLERY_CATEGORIES.includes(raw.toLowerCase().trim())
        ? raw.toLowerCase().trim()
        : 'community';
      return res.status(200).json({ suggestion: category });
    }

    /* ---- Suggest a blog excerpt ---- */
    if (action === 'excerpt') {
      const { title, notes } = req.body;
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'A post title is required.' });
      }
      const safeTitle = title.slice(0, 200);
      const safeNotes = typeof notes === 'string' ? notes.slice(0, 2000) : '';

      const suggestion = await askClaude({
        system: 'You write short teaser excerpts (1-2 sentences, under 220 characters) for a sports storytelling blog called the Off Pitch Africa Playbook. CRITICAL: base the excerpt only on the title and notes given to you — never invent facts, quotes, statistics, names, or events that are not stated. If the notes are thin, write a general, factually-neutral teaser about the title alone rather than inventing specifics. Respond with only the excerpt text, nothing else.',
        content: [
          { type: 'text', text: `Title: ${safeTitle}\n\nNotes about what the post actually covers (may be empty): ${safeNotes || '(none provided)'}` }
        ],
        maxTokens: 150
      });
      return res.status(200).json({ suggestion });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('ai-assist error:', err);
    return res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
}
