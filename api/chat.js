// Serverless function for the Off Pitch Africa chat assistant.
// Deploy target: Vercel (zero-config — any file in /api becomes an endpoint).
// Requires an environment variable ANTHROPIC_API_KEY set in your hosting
// provider's dashboard. Never put the API key in frontend code.
//
// SECURITY NOTES (see SECURITY.md for the full picture):
// - CORS is restricted to this site's own origin(s) below.
// - Input is length-capped and type-checked before it's ever sent to Anthropic.
// - A lightweight in-memory rate limiter blocks rapid-fire abuse from a single
//   IP. It resets when the function cold-starts (serverless instances aren't
//   persistent), so it's a best-effort speed bump, not a hard guarantee — see
//   SECURITY.md for the recommended production-grade upgrade (Upstash).
// - Error messages returned to the browser never include raw API responses,
//   stack traces, or the API key itself — only a generic message. Full detail
//   goes to server-side logs only (visible to you in Vercel, not visitors).

const ALLOWED_ORIGINS = [
  'https://off-pitch-nine.vercel.app'
  // Add your custom domain here once you have one, e.g.:
  // 'https://offpitchafrica.com'
];

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_ENTRIES = 10;
const MAX_HISTORY_ENTRY_LENGTH = 1000;

// Best-effort in-memory rate limit: N requests per IP per minute.
// Resets on cold start / across instances — see SECURITY.md.
const RATE_LIMIT = 12; // requests
const RATE_WINDOW_MS = 60 * 1000;
const requestLog = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  // Prevent unbounded growth of the map across many distinct IPs.
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
}

const SYSTEM_PROMPT = `
You are the website chat assistant for OFF PITCH AFRICA, a Kenyan sports media
and storytelling platform. Answer only using the facts below. If someone asks
something you can't answer from these facts, say you're not sure and point
them to the contact details below rather than guessing.

FACTS ABOUT OFF PITCH AFRICA:
- OFF PITCH AFRICA is a dynamic Kenyan sports media and storytelling platform
  dedicated to amplifying the untold narratives of African athletes to the
  world. It goes beyond match results to explore the human stories,
  challenges, and triumphs that define life off the pitch.
- Founded by Bonphace Odhiambo Otieno, who also hosts the Off Pitch Podcast.
- Mission: To empower African athletes and sports stakeholders by providing a
  platform for authentic storytelling that inspires, informs, and drives the
  growth of sports across the continent.
- Vision: To become Africa's leading sports storytelling platform, recognized
  globally for shaping narratives that influence sports culture, policy, and
  development.
- Core values: Authenticity (real, unfiltered stories told by us, on the
  pitch and off it), Excellence (high quality production through training and
  skills development), Community (sports personalities, media gurus, fans,
  data analysts, events organizers, strategic marketers, business people),
  Innovation (sustainable digital solutions for sports, events production,
  coverage and marketing).
- Services:
  1. Off Pitch Podcast — studio conversations with players, fans, policy
     makers, brand influencers and investors about sustainable development
     for African players and sport.
  2. Sports Coverage — live commentary and live data analysis from the pitch
     to the studio; coverage from community level to global stages, across
     disciplines including hockey and football.
  3. Digital Content Creation — sports news in long and short form, custom
     team reels for institutions and leagues, fan-collaborated "Off Pitch
     Reels", and SDG campaign content on mental health, gender equity,
     climate action and peace.
  4. Events Organization — tournament events, league proceedings coverage,
     and public/corporate themed events on demand.
  5. Sports Analysis — expert commentary and analysis across disciplines.
  6. Brand Partnerships — partnering with organizations, selling brand
     merchandize, and customizing brand promotion on request.
- Featured coverage: Africa Cup of Nations Hockey (commentators), Kenya
  Hockey Union League (experts), Kenyatta University Annual KU Opens, Mixed
  Martial Arts & Boxing.
- Contact: phone +254 704 10 7373 (also on WhatsApp: https://wa.me/254704107373),
  email offpitchafrica@gmail.com, based in Nairobi, Kenya.
- Social media and where to listen:
  - Instagram: https://www.instagram.com/offpitchafrica/ (@offpitchafrica)
  - YouTube: https://www.youtube.com/@offpitchAfrica
  - TikTok: https://www.tiktok.com/@podcastoffpitch (@podcastoffpitch)
  - X (Twitter): https://x.com/PodcastoffPitch (@PodcastoffPitch)
  - Facebook: https://www.facebook.com/OffPitchAfrica
  - Off Pitch Podcast on Spotify: https://open.spotify.com/show/2E5mgDfKByqyDlk3zeuVN2
  - WhatsApp: https://wa.me/254704107373
  - OFFPITCH AFRICA PLAYBOOK (newsletter on Substack): https://offpitchafricaplaybook.substack.com/
    Tagline: "OffPitch Africa delivers powerful, human-centered stories from
    athletes across the continent — from major arenas to emerging grassroots
    talent."

- Website pages: Home (index.html), About (about.html), What We Do
  (services.html), Gallery (gallery.html), Contact (contact.html — has the
  contact form and a "Partner With Us" section).

Keep replies short (2-4 sentences), friendly, and specific. If someone wants
to start a partnership or book coverage, direct them to the contact form on
this page or the phone/email above.
`.trim();

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Reject cross-origin callers outright (defense in depth beyond CORS,
  // which only stops browsers — this stops scripted/server-side abuse too).
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests — please wait a moment and try again.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Chat function called but ANTHROPIC_API_KEY is not set.');
    return res.status(500).json({
      error: 'The assistant is not configured yet. Please try again later.'
    });
  }

  const body = req.body || {};
  const { message, history } = body;

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'A "message" string is required.' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
  }

  const safeHistory = Array.isArray(history)
    ? history
        .filter(m =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string' &&
          m.content.length <= MAX_HISTORY_ENTRY_LENGTH
        )
        .slice(-MAX_HISTORY_ENTRIES)
    : [];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [...safeHistory, { role: 'user', content: message }]
      })
    });

    if (!response.ok) {
      // Log full detail server-side only; never forward raw API errors to the browser.
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(502).json({ error: 'The assistant is temporarily unavailable. Please try again shortly.' });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find(block => block.type === 'text');
    const reply = textBlock ? textBlock.text : "Sorry, I couldn't put together a reply just now.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat function error:', err);
    return res.status(500).json({ error: 'Something went wrong reaching the assistant.' });
  }
}
