# AGENT.md — Off Pitch Africa Website

Context file for any AI agent (or human developer) working on this codebase.
Read this before making changes — it exists so future edits stay consistent
with how this project is actually built, and so real content never gets
quietly replaced with invented content.

---

## 1. What this project is

A 9-file marketing website for **Off Pitch Africa**, a Kenyan sports media
and storytelling platform (podcast, sports coverage, digital content,
events, analysis, brand partnerships). Founded by **Bonphace Odhiambo
Otieno**. Plain HTML/CSS/JS — no framework, no build step, no bundler.
Deployed on **Vercel**, which also hosts two serverless functions.

7 main content pages (Home, About, What We Do, Gallery, Blog, Videos,
Contact) plus 2 utility pages (Privacy Policy, 404). Live at
`https://off-pitch-nine.vercel.app`.

As of the most recent session: **PageSpeed Insights (mobile)** — Performance
93, Accessibility 100, Best Practices 100, SEO 100. See section 9 for the
optimization history if you're asked to push Performance further — most of
what's easy has been done; what's left involves real tradeoffs.

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
├── index.html            Home — hero, live social slideshow, featured
│                          coverage cards, watch row, playbook CTA
├── about.html             Mission, vision, founder, core values
├── services.html          All 6 services + featured coverage badges
├── gallery.html           Filterable hex-grid photo gallery
├── blog.html              OffPitch Africa Playbook (Substack)
├── videos.html            Real YouTube videos + Spotify podcast
├── contact.html           Working contact form + all contact details
├── admin.html             Password-protected content dashboard (see §9a)
├── privacy.html           Privacy Policy (real data-flow disclosures)
├── 404.html               Branded error page (Vercel auto-serves this)
├── sitemap.xml            All 7 main pages, for search engines
├── robots.txt             Allows crawling, points to sitemap.xml —
│                           blocks admin.html and /api/ from indexing
├── package.json           Minimal — no dependencies at all
├── vercel.json            Global security headers (CSP, HSTS, etc.)
├── SECURITY.md            Full security posture — read before touching
│                          api/*.js or vercel.json
├── README.md              Setup/deployment instructions for the client
├── AGENT.md               This file
├── data/
│   ├── events.json         Upcoming events (Home page) — see §9a
│   ├── gallery.json         Gallery photos + captions
│   ├── blog.json            Individual blog post links (empty = none yet)
│   ├── videos.json          YouTube video IDs (Videos page)
│   └── live.json            Manual Facebook/Instagram/TikTok live toggle
├── assets/
│   ├── css/style.css       ONE shared stylesheet for all 9 public pages
│   ├── css/admin.css       Styles for admin.html only
│   ├── js/main.js          ONE shared script: nav, chat widget, contact
│   │                        form, gallery filter, live social feed,
│   │                        non-blocking font/CSS swap logic, and reading
│   │                        the /data/*.json files above (see §9a)
│   ├── js/admin.js         Admin dashboard behavior (login, item editor,
│   │                        client-side image compression, save/upload)
│   └── img/                Logo (png+webp), real client photos (webp,
│                            with .jpg kept only for OG/social-share tags),
│                            favicons/, uploads/ (dashboard-uploaded images)
└── api/
    ├── chat.js             AI chat assistant (calls Anthropic API)
    ├── social-feed.js      Live social media feed (YouTube/Instagram/
    │                        Facebook official APIs, not scraping)
    ├── admin.js            Admin dashboard backend — auth + commits
    │                        content changes to this repo via GitHub's API
    ├── ai-assist.js        AI content-assist for the dashboard (alt text,
    │                        category, blog excerpt suggestions), §9c
    └── live-status.js      Checks YouTube for an active live broadcast
                             (powers the live-stream banner on Home, §9b)
```

Every page is a **fully self-contained HTML file** — there's no templating
system or includes. The header, footer, and chat widget markup is
duplicated identically across all 9 files. **When changing shared UI (nav
links, footer columns, chat widget), you must edit all 9 HTML files
identically** — a script-based find/replace across all files at once is the
reliable way to do this without missing one.

### Important: critical CSS is ALSO duplicated (read this before touching header/nav/hero styles)

Every page's `<head>` contains an inlined, minified `<style>` block with
"critical" CSS (header, nav incl. mobile drawer, both hero types, buttons,
ticker, chat toggle button) — this renders above-the-fold content instantly
without waiting on a network request. The **full** stylesheet
(`assets/css/style.css`) then loads non-blocking via a `media="print"` →
JS-swap trick (handled in `main.js`, see section 6) and covers everything
else (About/Services/Gallery content, footer, forms, cards, etc.).

**This means header/nav/hero/button/ticker/chat-toggle styles now exist in
TWO places: the inline `<style>` block in every page's `<head>`, AND
`assets/css/style.css`.** If you change any of those specific rules, you
must update both, or the two will drift out of sync (the inline version
wins on first paint; the external one applies once it swaps in a moment
later, so a mismatch causes a visible flash/jump). This was a deliberate
tradeoff accepted by the client to push Performance from 77 to 92+ — don't
"simplify" it away without checking with the client first, since reverting
it will measurably hurt the Performance score again.

Google Fonts and the site's own stylesheet both use this same non-blocking
pattern with `id="gfonts-link"` and `id="site-css"` respectively — both get
swapped from `media="print"` to `media="all"` by an IIFE at the very top of
`main.js` that runs immediately (not inside `DOMContentLoaded`). **Every
page must include `<script src="assets/js/main.js">` for this to work** —
this was once forgotten on `404.html` and silently broke its fonts/CSS for
a while; don't repeat that mistake on any future new page.

---

## 4. Design system

All colors are CSS variables in `assets/css/style.css` **and** duplicated in
the inline critical CSS block (`:root` block appears in both places — see
section 3). Never hardcode a hex color for a surface/background — use the
variable so a future palette change only requires editing it in both spots.

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
badges, ticker), **Inter** (body text), loaded from Google Fonts with
**`font-display:optional`** (not `swap`) — a deliberate client choice: zero
layout shift from font-swapping, at the cost of occasionally showing a
fallback system font permanently on very slow connections. Don't change
this back to `swap` without checking with the client — they explicitly
chose `optional` after seeing the CLS tradeoff named in Lighthouse's
"Agentic Browsing" check.

**Contrast**: every text/background color pair on this site has been
verified against real WCAG contrast math (not eyeballed) — see section 9.
If you introduce a new text color, compute its contrast ratio before
shipping; this project has caught and fixed 4 real failures this way
already, most recently the WhatsApp pill (white text on bright green was
nearly unreadable — fixed by switching to dark text on that same green).

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
- **4 real YouTube video IDs** in use: `onYddyoXVA8`, `DPB-AwIypSI`,
  `plkNXmQ96tk`, `ikjlL1JYTzw` (client-provided, used on Home's Watch row
  and the Videos page; thumbnails pulled live from `img.youtube.com`)

All photos in `assets/img/` are real client photos (event coverage, the
founder/host, branded merchandise) — not stock imagery. Filenames describe
their real content (e.g. `trophy_handshake.webp`, `host_ku_gate.webp`).
Most are `.webp` now (converted for file-size savings); the matching `.jpg`
is kept alongside for Open Graph/Twitter Card meta tags specifically, since
some social-media link-preview crawlers are inconsistent with WebP — don't
delete the `.jpg` files even though pages no longer display them directly.

---

## 6. The two serverless functions

### `api/chat.js`
AI chat widget on every page. Calls the Anthropic API server-side (key
never touches the frontend). System prompt is grounded strictly in section
5's facts above — if you add new real facts to the site, add them to this
prompt too so the assistant stays accurate. Has CORS restriction, input
length limits, and a best-effort in-memory rate limiter (see SECURITY.md
for why it's "best-effort" and what the real production fix would be).
**Not functional yet** — returns errors until the client adds Anthropic
billing/credit (see section 10).

### `api/social-feed.js`
Live-fetches recent photos from YouTube/Instagram/Facebook's **official
APIs** (never scraping — this was a deliberate decision after discussing
ToS/reliability tradeoffs with the client) and feeds the Home page's hero
slideshow + Featured Coverage cards. Falls back silently to static content
if a platform isn't configured. The fetch itself is deliberately **deferred
until after the `window.load` event** (plus a 200ms buffer) in `main.js` —
this was a performance fix so it doesn't compete with critical resources
during initial page load. Requires env vars — none are set yet (client
paused mid-setup on Google Cloud's mandatory 2FA requirement for the
YouTube key; Instagram/Facebook need a Meta Developer app + tokens, not yet
started).

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
requests from the new domain. `sitemap.xml` and `robots.txt` also hardcode
this domain and would need the same update.

### Recurring workflow gotcha worth knowing up front
Files get generated/edited in an isolated sandbox, not directly in the
client's real project folder. **Every time a new binary asset (image,
favicon, etc.) is introduced, the client must manually download it and
place it in their actual local folder before redeploying** — code changes
alone aren't enough if they reference a file that doesn't exist locally yet.
This has caused "nothing changed" / "images are broken" confusion multiple
times in this project already (most recently with the WebP conversions).
When introducing any new binary file, explicitly tell the client the exact
target path and confirm they've added it before assuming a deploy will show
the change.

---

## 8. Security posture

Full detail in `SECURITY.md` — read it before touching `vercel.json` or
either file in `api/`. Summary: CSP + standard security headers globally,
CORS + rate limiting + input validation on both API endpoints, honeypot +
bot-speed-trap on the contact form, no database/SQL anywhere (so no SQLi
surface), no user auth system (so no session/CSRF surface in the classic
sense — protected the actual relevant thing instead, which is the API
endpoints and the accounts that operate the site).

**CSP note relevant to future changes**: `script-src` is `'self'` with no
`'unsafe-inline'` — this already caused one near-miss (an inline
`onload="..."` attribute for the font-swap trick would have been silently
blocked; the fix was moved into `main.js` instead, see section 3). Any
future inline event handler or `<script>` block will be silently blocked by
this CSP. `style-src` DOES allow `'unsafe-inline'` (needed for the many
inline `style=""` attributes throughout the HTML, and for the critical CSS
`<style>` blocks) — so inline styles are fine, inline scripts are not.

---

## 9. Performance/accessibility optimization history

Started at Performance 70 / Accessibility 95 (mobile, PageSpeed Insights)
and was pushed to **93 / 100** through several real, measured fixes (not
guesses) — useful precedent if asked to optimize further:

1. **WebP conversion** of all real photos (~34% smaller) + logo.png
   shrunk from 1129×1160/260KB down to 194×200/13KB (WebP) — it was being
   served at full source resolution while displayed at ~90px.
2. **Google Fonts + own stylesheet made non-blocking** via the
   `media="print"` → JS-swap trick (see section 3).
3. **Critical CSS inlined** per page — the single biggest win (77→92).
4. **`/api/social-feed` fetch deferred** until after `window.load`.
5. **Accessibility fixes**: found via real Lighthouse audit output, not
   guessed — 3 genuine WCAG contrast failures (stats note text, footer
   text, WhatsApp pill text) computed and fixed with verified ratios.
6. **`font-display:optional`** (see section 4) traded a small chance of
   fallback-font display for zero layout shift.

**Remaining gap to 100 Performance involves real tradeoffs, not easy
wins** — e.g. YouTube thumbnail cache headers (third-party, not fixable by
us), and serving different image sizes per viewport (would need real
responsive-image infrastructure). Don't promise the client an easy path to
100 without flagging these tradeoffs honestly, same as was done here.

---

## 9a. Admin dashboard (content management without code)

As of this session, `/admin.html` is a password-protected dashboard that
lets the client manage **Events, Gallery, Blog links, and Videos** without
touching code. This changed how content flows through the site — read this
before editing any of `index.html`'s events section, `gallery.html`,
`blog.html`, or `videos.html`.

**Architecture**: the four JSON files in `/data` (`events.json`,
`gallery.json`, `blog.json`, `videos.json`) are now the real content source
for these sections — not the HTML. Each public page fetches its
corresponding JSON file client-side (see the new functions in `main.js`,
just above the social-feed code) and rebuilds the section from it. If the
fetch fails or the file is empty/missing, the **static HTML already in the
page** (marked `data-fallback="true"`) is left untouched — same fail-safe
pattern already used for the live social feed, applied consistently here.

**This means**: the static markup still sitting in `index.html` (events),
`gallery.html` (hex-grid), and `videos.html` (media-row) is not dead code —
it's the fallback shown before JS runs / if the fetch fails, so it must stay
in sync with reality about as much as before. But the **source of truth**
for what's actually displayed (once JS runs) is the JSON files.

**Writing** to those JSON files happens two ways:
1. Through `/admin.html` → `api/admin.js`, which authenticates (signed
   session cookie, password in `ADMIN_PASSWORD` env var) and commits changes
   straight to this GitHub repo via GitHub's REST API (`GITHUB_TOKEN` env
   var, scoped to Contents: Read/write only on this repo). Every save is a
   real commit — check git history if content ever needs to be traced back.
2. Through a future Claude session editing the JSON files directly (fine to
   do — they're just files, same no-fabrication rule applies to their
   content as everything else on this site).

**Image uploads** from the dashboard go through client-side canvas
compression (max 1200px, JPEG ~82% quality) before being committed to
`assets/img/uploads/` — so images landing there via the dashboard are
already web-optimized; don't assume they need the same WebP-conversion pass
as manually-added photos (though converting to WebP later is still fine).

**Full setup/usage instructions**: see README.md section 7 — includes exact
steps for the client to generate their GitHub token, password, and session
secret.

---

## 9b. Live stream banner

A banner (`#liveBanner` on `index.html`, populated by `main.js`) shows when
Off Pitch is broadcasting live — hidden the rest of the time. Two sources,
checked independently:

1. **YouTube** — auto-detected via `api/live-status.js`, which calls the
   YouTube Data API's `search.list` with `eventType=live`. Uses the same
   `YOUTUBE_API_KEY` / `YOUTUBE_CHANNEL_ID` env vars already documented for
   the (paused) social feed — no new setup needed once those are set. When
   live, the actual video is embedded directly on the page (real YouTube
   iframe player, not just a link).
   **Quota note**: this check is expensive (100 units/call against a
   10,000/day default quota), so the response is edge-cached for 15 minutes
   (`Cache-Control` in `live-status.js`) — this caps it around ~96 calls/day
   total *regardless of visitor count*, safely under quota. Don't shorten
   that cache window without requesting a quota increase from Google Cloud
   first, or the key will start failing silently once quota runs out.
2. **Facebook / Instagram / TikTok** — Meta doesn't offer a simple embed for
   live video, so this is a **manual toggle** in the admin dashboard's
   "Live" tab (`data/live.json`: `{active, platform, url, label}`). The
   client flips it on right before going live elsewhere, pastes the live
   post URL, and the banner shows a "Watch Live →" link-out button instead
   of an embed. They flip it off when done.

If YouTube live is detected, it takes priority over the manual toggle (an
embedded player is better than a link-out when both are technically
possible). If neither is active, the banner stays hidden — no fabricated
"upcoming" state, consistent with this project's no-fabrication rule.

---

## 9c. AI content-assist (admin dashboard)

Small "✨ Suggest" buttons next to certain fields in `admin.html`:
- **Gallery**: suggest alt text and a category (hockey/community/celebration)
  for an uploaded photo — vision call to Claude, describes only what's
  visible in the image, never invents names/events it can't see.
- **Blog**: suggest a short excerpt from just the post title (and nothing
  else it doesn't know) — the system prompt explicitly forbids inventing
  facts, quotes, or specifics not given to it.

**This never auto-saves.** A suggestion only fills the field in memory and
on screen — the section's existing **Save Changes** button is still the
only thing that commits anything, so human review is structural, not a
bolted-on checkbox. This matters for this project's no-fabrication rule:
AI-drafted text is a *draft*, always reviewed before it can reach the site.

**Backend**: `api/ai-assist.js` — reuses the same `ANTHROPIC_API_KEY` as
`api/chat.js` (same Claude Haiku model), and the same admin session cookie
as `api/admin.js` (the verify-session logic is duplicated rather than
shared, following this project's existing convention of self-contained
`/api` files). **Same billing dependency as the chat widget** — inactive
until `ANTHROPIC_API_KEY` has usable credit (see §10).

If asked to extend this to new fields, keep the same constraint: the model
must only describe/summarize what it's actually given (an image, a title) —
never invent event specifics, quotes, or claims. That's not a suggestion,
it's this project's core rule (§2) applied to AI-generated drafts too.

---

## 10. Known deferred/pending items

The client has explicitly chosen to defer these — don't build them
unprompted, but pick them back up if asked:

- **YouTube API key** — paused when Google Cloud demanded 2FA on the
  client's account; should be quick to finish once resumed.
- **Instagram/Facebook API credentials** for `social-feed.js` — needs a
  Meta Developer app + long-lived tokens; not yet started.
- **TikTok integration** for the social feed — agreed approach is
  oEmbed-per-URL (client pastes video links, same pattern as YouTube),
  not the full OAuth Display API (too much refresh-token maintenance
  overhead for this project's scale).
- **Anthropic billing** — chat assistant is built but returns errors until
  the client adds a payment method/credit at console.anthropic.com.
- **Formspree autoresponder** — a dashboard toggle (Workflow tab → Auto
  Response), not code; last known status was still pending confirmation
  from the client.
- **Upstash-based rate limiting** — current limiter is in-memory/best-effort;
  offered as the "real" production upgrade, not yet built.
- **Google reCAPTCHA v3** on the contact form — offered as a stronger
  spam-prevention layer beyond the current honeypot + bot-speed-trap.
- **Individual Blog post links** — `blog.html` shows the Substack
  publication generally; specific post titles/links need the client to
  send them (Substack's post list is JS-rendered, blocking automated fetch).

---

---

## 11. Working conventions established in this project

- Prefer editing the shared `assets/css/style.css` / `assets/js/main.js`
  over inline styles/scripts when the change applies to more than one page
  — but remember the critical-CSS duplication from section 3 for
  header/nav/hero specifically.
- When adding a new page, copy the full header/footer/chat-widget block
  (including the critical `<style>` block and non-blocking stylesheet
  links) from an existing page exactly, then update: `<title>`, OG/Twitter
  meta tags, nav `active` class, breadcrumb text, and hero content — don't
  rebuild these from scratch, to avoid drift between pages.
- Always validate after edits: HTML tag-balance checks, `node --check` on
  any `.js` file, `json.load()`/`xml` parse on config files — this project
  has caught real bugs this way (the `backdrop-filter` containing-block bug
  that broke the mobile nav drawer; a missing `width:auto` that squished
  the footer logo after adding CLS-fix width/height attributes).
- When computing color contrast, do the actual WCAG math (relative
  luminance formula) rather than eyeballing it — this project's real
  accessibility fixes all came from computed ratios, and guessing wasted a
  full round-trip once (guessed the chat input label was the issue; the
  real failures were 3 unrelated contrast pairs).
- When something can't be verified as real (an image, a stat, a caption),
  say so explicitly to the client rather than silently proceeding — this
  has been the consistent pattern throughout the project and the client
  has responded well to it.
- Remember section 7's file-transfer gotcha — always tell the client
  exactly which new files need manual placement, and where.
