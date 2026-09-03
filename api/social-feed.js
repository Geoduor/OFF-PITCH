// Off Pitch Africa — social media slideshow feed
// Serverless function (Vercel). Live-fetches recent photos/thumbnails from
// YouTube, Instagram, and Facebook using each platform's OFFICIAL API — no
// scraping. Requires environment variables (see README.md, section 6):
//
//   YOUTUBE_API_KEY        — Google Cloud API key with YouTube Data API v3 enabled
//   YOUTUBE_CHANNEL_ID      — defaults to Off Pitch Africa's channel if unset
//   IG_ACCESS_TOKEN         — Instagram long-lived access token (Business/Creator account)
//   FB_PAGE_ID              — Off Pitch Africa's Facebook Page ID
//   FB_PAGE_ACCESS_TOKEN    — Facebook Page access token
//
// Any platform whose env vars are missing is silently skipped — the
// slideshow just uses whichever sources are configured. If none are
// configured, this returns an empty array and the frontend falls back to
// the static hero photo.

const DEFAULT_YT_CHANNEL_ID = 'UC9KSYu8ggh9TSEtn8PSYj1A'; // Off Pitch Africa

async function fetchYouTube() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];
  const channelId = process.env.YOUTUBE_CHANNEL_ID || DEFAULT_YT_CHANNEL_ID;

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&order=date&maxResults=6&type=video`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('YouTube API error:', res.status, await res.text());
      return [];
    }
    const data = await res.json();
    return (data.items || [])
      .filter(item => item.snippet && item.snippet.thumbnails)
      .map(item => {
        const thumb = item.snippet.thumbnails.maxres
          || item.snippet.thumbnails.high
          || item.snippet.thumbnails.medium
          || item.snippet.thumbnails.default;
        return {
          src: thumb.url,
          alt: item.snippet.title || 'Off Pitch Africa on YouTube',
          source: 'youtube',
          link: `https://www.youtube.com/watch?v=${item.id.videoId}`
        };
      });
  } catch (err) {
    console.error('YouTube fetch failed:', err);
    return [];
  }
}

async function fetchInstagram() {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) return [];

  try {
    const url = `https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption&limit=8&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Instagram API error:', res.status, await res.text());
      return [];
    }
    const data = await res.json();
    return (data.data || [])
      .filter(item => item.media_type === 'IMAGE' || item.media_type === 'CAROUSEL_ALBUM' || item.media_type === 'VIDEO')
      .map(item => ({
        src: item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url,
        alt: (item.caption || 'Off Pitch Africa on Instagram').slice(0, 120),
        source: 'instagram',
        link: item.permalink
      }))
      .filter(item => !!item.src);
  } catch (err) {
    console.error('Instagram fetch failed:', err);
    return [];
  }
}

async function fetchFacebook() {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;
  if (!token || !pageId) return [];

  try {
    const url = `https://graph.facebook.com/v19.0/${pageId}/photos?type=uploaded&fields=source,name,link&limit=8&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error('Facebook API error:', res.status, await res.text());
      return [];
    }
    const data = await res.json();
    return (data.data || [])
      .map(item => ({
        src: item.source,
        alt: (item.name || 'Off Pitch Africa on Facebook').slice(0, 120),
        source: 'facebook',
        link: item.link
      }))
      .filter(item => !!item.src);
  } catch (err) {
    console.error('Facebook fetch failed:', err);
    return [];
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// SECURITY: only ever hand the frontend a well-formed https:// URL. Even
// though these values come from official platform APIs (not free-text user
// input), we treat any external API response as untrusted before it's used
// in the browser as an <img src> or an <a href> — a compromised or
// misbehaving upstream response should never be able to smuggle a
// javascript: URI or similar into the page.
function isSafeHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeImages(images) {
  return images.filter(img => img && isSafeHttpsUrl(img.src) && (!img.link || isSafeHttpsUrl(img.link)));
}

const ALLOWED_ORIGINS = [
  'https://offpitchafrica.com'
];

// Best-effort in-memory rate limit — see chat.js and SECURITY.md for details
// on why this is a speed bump, not a hard guarantee, on serverless.
const RATE_LIMIT = 30;
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

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();
  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const [youtube, instagram, facebook] = await Promise.all([
    fetchYouTube(),
    fetchInstagram(),
    fetchFacebook()
  ]);

  const combined = sanitizeImages(shuffle([...instagram, ...facebook, ...youtube])).slice(0, 10);

  // Cache at the edge for an hour, serve stale for a day while revalidating —
  // keeps this well within every platform's free API rate limits.
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({
    images: combined,
    sources: {
      youtube: youtube.length,
      instagram: instagram.length,
      facebook: facebook.length
    }
  });
}
