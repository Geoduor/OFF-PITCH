# AGENT.md — Off Pitch Africa Website

Context file for any AI agent (or human developer) working on this codebase.
Read this before making changes — it exists so future edits stay consistent
with how this project is actually built, and so real content never gets
quietly replaced with invented content.

---

## 1. What this project is

A 7-page marketing website for **Off Pitch Africa**, a Kenyan sports media
and storytelling platform (podcast, sports coverage, digital content,
events, analysis, brand partnerships). Founded by **Bonphace Odhiambo
Otieno**. Plain HTML/CSS/JS — no framework, no build step, no bundler.
Deployed on **Vercel**, which also hosts two serverless functions.

## 2. The single most important rule

**Never invent facts, numbers, testimonials, team members, post titles, or
stats for this client.** Every piece of content on this site — mission,
vision, values, service descriptions, contact info, social handles, photo
captions, video links — was sourced from one of:
- The client's company profile PDF
- Their live Linktree
- Direct fetches of their real Instagram/YouTube/Facebook/Substack/Spotify
- Photos the client uploaded directly
- URLs the client pasted directly (e.g. specific YouTube video links)

If new content is needed and no real source exists yet, **leave a clearly
labeled placeholder and ask the client for the real information** — the
same pattern already used for the Blog page's post list and the Home page's
stats strip. Do not fill gaps with plausible-sounding invented content, even
temporarily "to see how it looks."

---

## 3. File structure

```
/
├── index.html            Home — full-bleed hero, live social slideshow,
│                          featured coverage cards, watch row, playbook CTA
├── about.html             Mission, vision, founder, core values
├── services.html          All 6 services + featured coverage badges
├── gallery.html           Filterable hex-grid photo gallery
├── blog.html              OffPitch Africa Playbook (Substack)
├── videos.html            Real YouTube videos + Spotify podcast
├── contact.html           Working contact form + all contact details
├── privacy.html           Privacy Policy (real data-flow disclosures)
├── 404.html               Branded error page (Vercel auto-serves this)
├── sitemap.xml            All 7 real pages, for search engines
├── robots.txt             Allows crawling, points to sitemap.xml
├── package.json           Minimal — no dependencies, just a `vercel dev` script
├── vercel.json            Global security headers (CSP, HSTS, etc.)
├── SECURITY.md            Full security posture — read before touching
│                          api/*.js or vercel.json
├── README.md              Setup/deployment instructions for the client
├── AGENT.md               This file
├── assets/
│   ├── css/style.css       ONE shared stylesheet for all 7 pages
│   ├── js/main.js          ONE shared script: nav, chat widget, contact
│   │                        form, gallery filter, live social feed
│   └── img/                Logo, real client photos, favicons/
└── api/
    ├── chat.js             AI chat assistant (calls Anthropic API)
    └── social-feed.js      Live social media feed (YouTube/Instagram/
                             Facebook official APIs, not scraping)
```

Every page is a **fully self-contained HTML file** — there's no templating
system or includes. The header, footer, and chat widget markup is
duplicated identically across all 7 files. **When changing shared UI
(nav links, footer columns, chat widget), you must edit all 7 HTML files
identically** — a script-based find/replace across all files at once is the
reliable way to do this without missing one (see the pattern used when Blog
and Videos were added to the nav).

---

## 4. Design system

All colors are CSS variables in `assets/css/style.css` (`:root`). Never
hardcode a hex color for a surface/background — use the variable so a
future palette change (like the navy→warm-black fix) only requires editing
one line.

```css
--pitch-red:#C8102E;        /* primary brand red */
--pitch-red-deep:#7A0C1E;   /* darker red for gradients */
--ink:#0B0B0D;               /* primary near-black background */
--navy:#171212;              /* secondary surface — warm near-black,
                                NOT blue-tinted (this was a real bug fixed
                                once already — don't reintroduce indigo) */
--studio-blue:#0E6BA8;       /* small accent only — matches the logo's mic */
--signal-teal:#4FD1D9;       /* small accent only — matches the logo's dot */
--chalk:#F4F1EC;              /* off-white text on dark backgrounds */
--paper:#FBFAF7;              /* light section background (Services) */
```

**Brand identity is black + red**, with blue/teal used only sparingly as
accents (they appear in the actual logo mark, so they're legitimate, but
should never become a dominant surface color).

Fonts: **Anton** (headings/display), **Space Mono** (eyebrows, labels,
badges, ticker), **Inter** (body text). All loaded via Google Fonts in each
page's `<head>`.

---

## 5. Real content reference (so it's never re-fabricated)

- **Founder**: Bonphace Odhiambo Otieno (also hosts the Off Pitch Podcast)
- **Phone**: +254 704 10 7373 · **Email**: offpitchafrica@gmail.com
- **Location**: Nairobi, Kenya
- **Instagram**: instagram.com/offpitchafrica
- **YouTube**: youtube.com/@offpitchAfrica (channel ID `UC9KSYu8ggh9TSEtn8PSYj1A`)
- **TikTok**: tiktok.com/@podcastoffpitch
- **X**: x.com/PodcastoffPitch
- **Facebook**: facebook.com/OffPitchAfrica
- **Spotify**: open.spotify.com/show/2E5mgDfKByqyDlk3zeuVN2
- **Substack**: offpitchafricaplaybook.substack.com ("OffPitch Africa
  delivers powerful, human-centered stories from athletes across the
  continent — from major arenas to emerging grassroots talent.")
- **6 services**: Off Pitch Podcast, Sports Coverage, Digital Content
  Creation, Events Organization, Sports Analysis, Brand Partnerships
- **4 core values**: Authenticity, Excellence, Community, Innovation
- **Real featured coverage**: AFCON Hockey (commentators), Kenya Hockey
  Union League (experts), Kenyatta University Annual KU Opens, MMA & Boxing

All photos in `assets/img/` are real client photos (event coverage, the
founder/host, branded merchandise) — not stock imagery. Filenames describe
their real content (e.g. `trophy_handshake.jpg`, `host_ku_gate.jpg`).

---

## 6. The two serverless functions

### `api/chat.js`
AI chat widget on every page. Calls the Anthropic API server-side (key
never touches the frontend). System prompt is grounded strictly in section
5's facts above — if you add new real facts to the site, add them to this
prompt too so the assistant stays accurate. Has CORS restriction, input
length limits, and a best-effort in-memory rate limiter (see SECURITY.md
for why it's "best-effort" and what the real production fix would be).

### `api/social-feed.js`
Live-fetches recent photos from YouTube/Instagram/Facebook's **official
APIs** (never scraping — this was a deliberate decision after discussing
ToS/reliability tradeoffs with the client) and feeds the Home page's hero
slideshow + Featured Coverage cards. Falls back silently to static content
if a platform isn't configured. Requires env vars documented in
`README.md` section 6 — none are set yet as of this writing (client paused
mid-setup on Google Cloud's MFA requirement).

**Environment variables** (set in Vercel dashboard, never in code):
`ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID` (optional),
`IG_ACCESS_TOKEN`, `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`.

---

## 7. Deployment

Client deploys via Vercel CLI: `vercel --prod` from the project root after
any change. No CI/build pipeline — Vercel serves the static HTML/CSS/JS
directly and runs `api/*.js` as serverless functions. `package.json` has no
dependencies, so there's nothing to `npm install`.

`ALLOWED_ORIGINS` in both `api/chat.js` and `api/social-feed.js` is
hardcoded to `https://off-pitch-nine.vercel.app` — **update this if the
client ever adds a custom domain**, or the API endpoints will reject
requests from the new domain.

---

## 8. Security posture

Full detail in `SECURITY.md` — read it before touching `vercel.json` or
either file in `api/`. Summary: CSP + standard security headers globally,
CORS + rate limiting + input validation on both API endpoints, honeypot +
bot-speed-trap on the contact form, no database/SQL anywhere (so no SQLi
surface), no user auth system (so no session/CSRF surface in the classic
sense — protected the actual relevant thing instead, which is the API
endpoints and the accounts that operate the site).

---

## 9. Known deferred/pending items

**Already completed** (don't rebuild): Open Graph/Twitter Card tags,
sitemap.xml, robots.txt, privacy.html, and a branded 404.html were all
added in a later session — see README.md section 7 for details. One small
manual step remains from that batch: **enabling Formspree's autoresponder**
in their dashboard (Workflow tab → Auto Response) — this is a client-side
toggle, not something an agent can do remotely.

The client has explicitly chosen to defer these — don't build them
unprompted, but pick them back up if asked:

- **TikTok integration** for the social feed (deferred: full API needs
  OAuth + refresh-token persistence; agreed approach is oEmbed-per-URL
  instead, same pattern as the YouTube video links)
- **Instagram/Facebook API credentials** for `social-feed.js` (client
  paused on Google Cloud's mandatory 2FA requirement)
- **Anthropic billing** — chat assistant is built but returns errors until
  the client adds a payment method/credit at console.anthropic.com
- **Upstash-based rate limiting** — current limiter is in-memory/best-effort;
  offered as the "real" production upgrade, not yet built
- **Google reCAPTCHA v3** on the contact form — offered as a stronger
  spam-prevention layer beyond the current honeypot + bot-speed-trap
- **Individual Blog post links** — `blog.html` shows the Substack
  publication generally; specific post titles/links need the client to
  send them (Substack's post list is JS-rendered, blocking automated fetch)

---

## 10. Working conventions established in this project

- Prefer editing the shared `assets/css/style.css` / `assets/js/main.js`
  over inline styles/scripts when the change applies to more than one page.
- When adding a new page, copy the full header/footer/chat-widget block
  from an existing page exactly, then update: `<title>`, nav `active`
  class, breadcrumb text, and hero content — don't rebuild these from
  scratch, to avoid drift between pages.
- Always validate after edits: HTML tag-balance checks, `node --check` on
  any `.js` file, `json.load()` on `vercel.json` — this project has caught
  real bugs this way (e.g. the `backdrop-filter` containing-block bug that
  broke the mobile nav drawer).
- When something can't be verified as real (an image, a stat, a caption),
  say so explicitly to the client rather than silently proceeding — this
  has been the consistent pattern throughout the project and the client
  has responded well to it.
