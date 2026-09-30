# Off Pitch Africa Codebase Summary

## Project Overview
A 9-page marketing website for **Off Pitch Africa**, a Kenyan sports media and storytelling platform (podcast, sports coverage, digital content, events, analysis, brand partnerships). Founded by **Bonphace Odhiambo Otieno**. Plain HTML/CSS/JS — no framework, no build step, no bundler. Deployed on **Vercel**.

### Page Structure
- `index.html` — Home with hero slideshow, live social feed, featured coverage cards, events teaser, watch row, events/fixtures teaser, playbook CTA
- `events.html` — Events & Fixtures board (full schedule + one-off events like "Off The Pitch, On The Record")
- `about.html` — Mission, vision, founder, core values + 6 services (merged from old `services.html`)
- `gallery.html` — Filterable hex-grid photo gallery + YouTube videos + Spotify podcast (merged from old `videos.html`)
- `merch.html` — 4 products: Hoodie (Kshs 3,500), T-Shirt (Kshs 1,000), Tank Top (Kshs 1,000), Bucket Hat (Kshs 1,000)
- `blog.html` — OffPitch Africa Playbook Substack posts with in-page reader
- `contact.html` — Working contact form + all contact details
- `privacy.html` — Privacy Policy
- `404.html` — Branded error page

## Core Rules & Conventions

### 1. No Fabrication (§2 AGENT.md)
**Never invent facts, numbers, testimonials, team members, post titles, or stats.** All content must come from:
- Client company profile PDF
- Live Linktree
- Real Instagram/YouTube/Facebook/Substack/Spotify fetches
- Client-uploaded photos
- URLs client pasted directly

If new content is needed with no real source: leave a clearly labeled placeholder and ask the client.

### 2. Content is in JSON files (`data/`)
Content is stored in 5 JSON files — these are the "database" for the static site:

| File | Content | Admin Panel |
|------|---------|-------------|
| `events.json` | Upcoming events (Home page) | Events tab |
| `gallery.json` | Gallery photos + captions | Gallery tab |
| `blog.json` | Individual blog post links | Blog tab |
| `videos.json` | YouTube video IDs | Videos tab |
| `live.json` | Manual Facebook/IG/TikTok live toggle | Live tab |

Every save through the admin dashboard commits a **real GitHub commit** — Vercel auto-deploys.

### 3. Frontend Architecture
- **`main.js`** — shared behavior across all pages:
  - Non-blocking stylesheet/fonts swap (`media="print"` → `media="all"`)
  - Cookie consent banner (GA4 gates until consent)
  - Contact form (Formspree) with bot-speed trap (2.5s minimum fill time)
  - Gallery filter (hex-grid category filtering)
  - Fixtures & Results filtering by competition/month/date
  - Live stream banner (YouTube auto-detect + manual toggle)
  - Dynamic content: Events, Gallery, Videos, Blog (all fetch JSON client-side)
  - Social feed deferral until `window.load` + 200ms buffer
  - Chat assistant widget

- **Critical CSS** is inlined in every page's `<head>` + duplicated in `assets/css/style.css`
  - **Must update both** when changing header/nav/hero/button/ticker/chat-toggle styles
  - Mentioned tradeoff: this was deliberate to push Performance from 77 → 92+

- **Fonts**: Anton (headings), Space Mono (labels/badges), Inter (body) — Google Fonts with `font-display:optional`

### 4. API Routes (`api/`)
All serverless functions on Vercel:

| Route | Purpose | Dependencies |
|-------|---------|-------------|
| `api/chat.js` | AI chat assistant (Anthropic Claude Haiku) | `ANTHROPIC_API_KEY` env var |
| `api/social-feed.js` | Live social media feed (YouTube/IG/FB) | YouTube/IG/FB API env vars |
| `api/admin.js` | Admin dashboard backend — auth + GitHub commits | `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `GITHUB_TOKEN` |
| `api/ai-assist.js` | AI "✨ Suggest" buttons (alt text/category/excerpt) | `ANTHROPIC_API_KEY`, admin session |
| `api/live-status.js` | YouTube live broadcast check | `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID` |

### 5. Security
- **CORS** restricted to `https://offpitchafrica.com`
- **Admin auth**: Password (`ADMIN_PASSWORD`) + HMAC-signed session cookie (`ADMIN_SESSION_SECRET`)
- **Rate limiting**: In-memory, best-effort, resets on cold start
- **Input validation**: All API endpoints validate content shape/length
- **CSP**: `script-src 'self'` (no `unsafe-inline`), `style-src` allows `unsafe-inline`
- **No database/SQL** anywhere — JSON files are the "database"
- **Formspree honeypot + bot-speed-trap** on contact form

### 6. Environment Variables (Vercel dashboard)
| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude Haiku key (required for chat + ai-assist) |
| `ADMIN_PASSWORD` | Dashboard login password |
| `ADMIN_SESSION_SECRET` | HMAC signing secret for session cookies |
| `GITHUB_TOKEN` | Fine-grained PAT, Read+write on this repo only |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `YOUTUBE_CHANNEL_ID` | Default: `UC9KSYu8ggh9TSEtn8PSYj1A` |
| `IG_ACCESS_TOKEN` | Instagram long-lived token |
| `FB_PAGE_ID` | Facebook Page numeric ID |
| `FB_PAGE_ACCESS_TOKEN` | Facebook Page access token |

### 7. Deployment
- `vercel --prod` from project root
- `.env` is gitignored; local `.env` used with `vercel dev` only
- Production env vars set in Vercel dashboard
- **Important**: Every new binary asset (image, etc.) must be manually downloaded and placed in the actual project folder — code changes alone aren't enough

### 8. Key Files Explored

#### `api/admin.js` — Full admin backend
- Password auth (timing-safe compare against `ADMIN_PASSWORD`)
- HMAC-signed session cookies (12hr TTL)
- GitHub REST API commits (`GITHUB_TOKEN`)
- Content validation per type (events, gallery, blog, videos, fixtures, live)
- Image upload with size limits (~950KB max)
- 8 API actions: login, logout, check, get, save, uploadImage

#### `api/chat.js` — AI chat assistant
- System prompt grounded in 22+ facts about Off Pitch Africa ( §5 AGENT.md)
- CORS, rate limiting, input caps (1000 chars)
- Returns error until `ANTHROPIC_API_KEY` has billing credit

#### `api/ai-assist.js` — AI "Suggest" buttons
- 3 actions: `altText` (image description), `category` (hockey/community/celebration), `excerpt` (blog teaser)
- Same Anthropic key + session cookie as other APIs
- **Never auto-saves** — suggestions only fill fields, human review required via Save Changes

#### `api/social-feed.js` — Live social media slideshow
- Fetches from YouTube/Instagram/Facebook official APIs
- Falls back silently if env vars not set
- Edge-cached 1 hour (`s-maxage=3600, stale-while-revalidate=86400`)
- Sanitizes all URLs to `https://` only

#### `api/live-status.js` — YouTube live check
- Returns `{live: true/false, videoId, title}` or `{live: false}`
- Edge-cached 15 min (`Cache-Control: public, max-age=900, stale-while-revalidate=300`)
- Returns `{live: false}` if key not set (graceful degradation)

#### `main.js` — Frontend behavior (1000+ lines)
- Non-blocking stylesheet swap
- Cookie consent + GA4 loading
- Mobile nav drawer
- Contact form with Formspree + bot-speed trap
- Gallery filter
- Fixtures/Results filtering (competition/month/date dropdowns)
- Live stream banner (YouTube auto + manual toggle)
- Dynamic content: Events, Gallery, Videos, Blog (JSON-driven)
- Social feed deferral until `window.load`
- Chat widget UI

#### CSS (`assets/css/style.css`) — Shared stylesheet (900+ lines)
- CSS variables: `--pitch-red`, `--pitch-red-deep`, `--ink`, `--navy`, `--studio-blue`, `--signal-teal`, `--chalk`, `--paper`
- Critical CSS also inlined per page
- Responsive breakpoints at 900px and 520px
- Design: black + red primary, blue/teal accents

### 9. Known Deferred/Pending Items (§10 AGENT.md)
- YouTube API key (2FA paused on client account)
- Instagram/Facebook API credentials (Meta Developer app + tokens needed)
- TikTok integration (agreed: oEmbed-per-URL approach)
- Anthropic billing/credit (chat + ai-assist inactive until setup)
- Formspree autoresponder (dashboard toggle, pending client confirmation)
- Upstash-based rate limiting (current: in-memory/best-effort)
- Google reCAPTCHA v3 on contact form
- Individual blog post links (already resolved: full posts now publish on-site)

### 10. Page Merges (§9f AGENT.md)
- `services.html` → merged into `about.html` (keeps mission/vision + 6 services grid)
- `videos.html` → merged into `gallery.html` (keeps photo grid + YouTube videos + podcast)
- Both old URLs 301-redirect via `vercel.json`

## Data Files Quick Reference

### `data/events.json` — 132 items
Off-pitch events + KHU tournament calendar entries. Each has: id, title, theme, date, time, venue, image, registerLink, phone, email, active.

### `data/gallery.json` — 121 items
Photos with: id, src, alt, category (hockey/community/celebration/event), caption, optional link.

### `data/blog.json` — 2 posts
Title, URL (Substack or site), excerpt, image. Each can have: body (paragraphs), links, url.

### `data/videos.json` — 6 items
YouTube video IDs with titles.

### `data/fixtures.json` — 1886+ items
Hockey5s Youth Africa Cup 2026 schedule + KHU Premier League/Super League/Nation League matches. Each has: id, competition, category (Men/Women), stage, date, time, team1, team2, score1/2, venue, status (upcoming/live/final).

### `data/live.json` — 1 item
`{active, platform, url, label}` — manual live toggle for social media platforms.