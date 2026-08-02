# Off Pitch Africa — Website (Multi-Page)

A 5-page marketing site for Off Pitch Africa: **Home, About, What We Do,
Gallery, Contact** — sharing one stylesheet, one script file, and the same
working contact form + AI chat assistant on every page.

Design direction is adapted from a sports-news site layout you shared as a
reference (full-bleed photo hero, scroll cue, card-style feature grid, stats
strip) — rebuilt using Off Pitch Africa's real brand colors, logo, photos,
and copy. No content was invented; see section 5 below for exactly what's
real vs. what you can still add.

---

## 1. Folder structure

```
/
├── index.html            Home
├── about.html             About (mission, vision, values, founder)
├── services.html          What We Do (all 6 services + featured coverage)
├── gallery.html           Gallery (filterable photo grid)
├── blog.html              Blog (OffPitch Africa Playbook on Substack)
├── videos.html            Videos (real YouTube videos + Spotify podcast)
├── contact.html           Contact (working form + all contact details)
├── admin.html             Password-protected content dashboard (see section 7)
├── privacy.html           Privacy Policy (what data is collected and how)
├── 404.html               Branded "page not found" error page
├── sitemap.xml            Lists all 7 real pages for search engines
├── robots.txt             Allows crawling, points to sitemap.xml — blocks admin.html/api/
├── package.json           minimal project file (for deployment)
├── vercel.json            global security headers (CSP, HSTS, etc. — see SECURITY.md)
├── SECURITY.md            full security documentation — read this
├── data/
│   ├── events.json         upcoming events shown on the Home page
│   ├── gallery.json         gallery photos + captions
│   ├── blog.json            individual blog post links (empty until added)
│   └── videos.json          YouTube video IDs shown on the Videos page
├── assets/
│   ├── css/style.css       shared styles for all 7 public pages
│   ├── css/admin.css       styles for the admin dashboard only
│   ├── js/main.js          shared behavior: nav, chat widget, form, gallery filter,
│   │                        and reading the /data/*.json files above
│   ├── js/admin.js         admin dashboard behavior (login, editing, image upload)
│   └── img/                logo + photos
└── api/
    ├── chat.js             serverless function powering the AI chat assistant
    ├── social-feed.js      serverless function powering the live social media feed
    └── admin.js            serverless function powering the admin dashboard
                             (auth + committing content changes to GitHub)
```

Keep this exact structure when you upload/deploy. Every page links to
`assets/css/style.css`, `assets/js/main.js`, and images under `assets/img/`
using relative paths — so the folder layout must stay intact.

**See `SECURITY.md`** for a full breakdown of what security measures are in
place, why, and what's still on you to set up (mostly 2FA on your various
accounts — can't do that one remotely).

---

## 2. What's already wired in (from before)

- **Contact form** → already connected to your live Formspree endpoint
  (`https://formspree.io/f/xykrplgy`) on `contact.html`. No further setup
  needed for this part.
- **Chat assistant** → calls `/api/chat`, a serverless function in
  `api/chat.js`, present on every page. This requires your Vercel deployment
  to have `ANTHROPIC_API_KEY` set (see below) **and** billing/credit active
  on your Anthropic account — the assistant will show a graceful fallback
  message until both are true.

If you already deployed the single-page version to Vercel, just push this
whole updated folder to the same project (or run `vercel --prod` again from
this folder) — your existing `ANTHROPIC_API_KEY` environment variable will
still apply, since it's set at the project level, not per-file.

---

## 3. Redeploying to Vercel

From inside this project folder:

```
vercel --prod
```

That's it if you've already got the project linked and the environment
variable set. If this is a fresh project instead, follow the same steps as
before:

1. `vercel` (first-time setup, accept defaults)
2. In the Vercel dashboard → your project → **Settings → Environment
   Variables**, add `ANTHROPIC_API_KEY` with your key from
   console.anthropic.com (requires billing/credit active on that account)
3. `vercel --prod` to redeploy with the key active

---

## 4. Local preview

Open `index.html` directly in a browser to check any page's design — all
five pages link to each other via the nav bar and footer. The contact form
and chat assistant work fully once deployed; locally, the chat will show its
fallback message since `/api/chat` only exists on a real deployment.

---

## 5. What's real vs. what you can still add

Everything on every page — mission, vision, founder, values, all 6 services,
featured coverage credits, contact info, social links, and photos — comes
directly from the Off Pitch Africa company profile and your live Linktree.
Nothing was invented.

**Design credit:** The Home page's news/video card grid was restyled to match
the layout of fih.hockey (the International Hockey Federation's official
site) — dark overlay-caption cards, a "Watch" video row with play-button
thumbnails, per your reference. The "Read The Playbook" callout card matches
the look of the Substack link-preview card you shared, using your real
Substack tagline pulled directly from offpitchafricaplaybook.substack.com.

Two spots are intentionally left as clearly-marked placeholders rather than
guessed at:

- **Stats strip on the Home page** (currently shows "6 Core Services," "4+
  Disciplines," etc. — safe facts, not guesses). If you have real numbers —
  episodes published, audience reach, events covered — send them over and
  we'll swap them in.
- **Watch row videos** (Home page and the new Videos page) link to your 4
  real YouTube videos, with thumbnails pulled live from YouTube's own CDN —
  fully real, not placeholders.
- **Gallery** uses the same photos from your company profile; add higher-res
  or additional event photos any time by dropping them into `assets/img/`
  and adding a `<div class="hexcell">` entry in `gallery.html`.
- **Blog page** (`blog.html`) features your real Substack publication (real
  tagline, real subscribe link), but doesn't list individual post titles
  yet — Substack's post list only renders via JavaScript, which blocks
  automated fetching, so I couldn't pull specific posts automatically. Send
  me 3-4 real post titles + links (same way you sent the YouTube video
  URLs) and I'll list them individually on the page.

The only setup items still on you:

- Anthropic billing/credit for the chat assistant to actually respond
  (see prior conversation — console.anthropic.com → Plans & Billing)
- The social media slideshow feed (below) needs its own API credentials

---

## 6. Live social feed (Home page hero + Featured Coverage cards)

The Home page hero background **and** the three "Featured Coverage" cards
now pull your **actual recent photos and captions from YouTube, Instagram,
and Facebook** — via each platform's official API (not scraping). Both are
powered by the same call to `api/social-feed.js`.

- **Hero background**: cross-fades between real recent photos every 6 seconds.
- **Featured Coverage cards**: once at least 3 real posts are available, the
  image, platform tag ("Instagram" / "Facebook" / "YouTube"), and text on
  each card are replaced with the real photo and real caption from that
  post — no invented headlines or categories, since a caption's actual
  wording is the only real data a post gives us.

**Nothing breaks if you skip this setup** — both sections just show their
existing static content (the same real facts pulled from your company
profile) until real posts are available. Each platform is independent.

### YouTube (easiest — ~5 minutes, free)

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a project (or use an existing one).
2. In the sidebar: **APIs & Services → Library** → search "YouTube Data API
   v3" → **Enable**.
3. **APIs & Services → Credentials** → **Create Credentials → API Key**.
   Copy the key.
4. In Vercel: **Settings → Environment Variables**, add:
   - `YOUTUBE_API_KEY` = the key you just copied
   - (optional) `YOUTUBE_CHANNEL_ID` — only needed if you ever change
     channels; it already defaults to Off Pitch Africa's channel.

### Instagram (~15 minutes — needs a Business or Creator account)

Your Instagram account must be a **Business or Creator account** (not
Personal) and linked to a Facebook Page. If it isn't yet, Instagram's app
settings will walk you through converting it — it's free and doesn't change
how you post.

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My
   Apps → Create App** → choose "Business" as the type.
2. In your new app's dashboard, add the **Instagram** product.
3. Follow Meta's setup flow to connect your Instagram account and generate a
   **long-lived access token** (their Graph API Explorer tool, linked from
   the same dashboard, can generate this — select your app, your Instagram
   permissions, and exchange for a long-lived token).
4. In Vercel: add environment variable `IG_ACCESS_TOKEN` = that token.

Long-lived tokens last ~60 days and need refreshing — Meta's docs cover the
refresh flow. If this becomes a hassle, let us know and we can add an
automatic refresh step.

### Facebook (~10 minutes — same Meta Developer app as Instagram)

1. In the same Meta app from the Instagram steps, make sure the **Pages**
   product is added.
2. Use Graph API Explorer to select your Page and generate a **Page Access
   Token** with the `pages_read_engagement` permission.
3. Also grab your Page's numeric ID (visible in Page settings, or via the
   Graph API Explorer response).
4. In Vercel: add `FB_PAGE_ID` and `FB_PAGE_ACCESS_TOKEN`.

### After adding any of these

Redeploy so Vercel picks up the new environment variables:

```
vercel --prod
```

Reload the Home page — if at least one platform is configured correctly,
the hero background will start cross-fading between real photos every 6
seconds. Open your browser's dev tools → Network tab → look for a call to
`/api/social-feed` to confirm it's returning images (check the `sources`
field in the response to see counts per platform).

---

## 7. Admin dashboard — update content without touching code

A password-protected page at **`/admin.html`** lets you add/edit/remove
**Events, Gallery photos, Blog post links, and Video IDs** directly from a
browser — no code editing, no local files. Every save is a real commit to
this GitHub repo (via GitHub's API), so Vercel picks it up and redeploys
automatically, same as any other push — usually live within 10–20 seconds.

The content lives in four small JSON files in `/data` (`events.json`,
`gallery.json`, `blog.json`, `videos.json`) — these are the actual "database"
for this static site. The public pages fetch them directly; the dashboard
reads and writes them through `api/admin.js`.

### One-time setup (do this before using the dashboard)

**1. Create a GitHub Personal Access Token** (lets the dashboard commit on
your behalf — scoped to only this repo, nothing else):
1. Go to [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. **Resource owner**: your GitHub account. **Repository access**: "Only
   select repositories" → choose `OFF-PITCH`.
3. **Permissions → Repository permissions → Contents** → set to
   **Read and write**. Leave everything else as "No access".
4. Generate the token and copy it immediately (GitHub only shows it once).

**2. Choose a dashboard password** — anything you'll remember; this is what
you'll type into `/admin.html` to log in.

**3. Generate a session secret** — a long random string used to sign login
sessions (you never need to remember this one). Run this locally, or use
any password generator:
```
openssl rand -hex 32
```

**4. Add all three as environment variables in Vercel** (Project → Settings
→ Environment Variables):
| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | the token from step 1 |
| `ADMIN_PASSWORD` | the password from step 2 |
| `ADMIN_SESSION_SECRET` | the random string from step 3 |

**5. Redeploy** (`vercel --prod`) so the new environment variables take effect.

### Using it day-to-day

1. Go to `https://off-pitch-nine.vercel.app/admin.html`
2. Log in with the password from step 2 above
3. Pick a tab (Events / Gallery / Blog / Videos), add/edit/remove items,
   upload photos directly (they're auto-compressed in your browser before
   upload — no need to resize anything yourself first)
4. Click **Save Changes** — you'll see a confirmation once the commit goes
   through, and the live site updates automatically within moments

**Notes**
- Images are capped at ~950KB after compression (plenty for web use, not
  meant for raw camera-original files).
- `admin.html` and `/api/*` are excluded from search engines via
  `robots.txt` and a `noindex` meta tag — but the real security boundary is
  the password + signed session, not obscurity.
- If the dashboard ever shows "Not logged in" unexpectedly, your session
  (12 hours) simply expired — just log in again.

---

## 8. Site hygiene: SEO, legal, and error page

A few standard-but-easy-to-miss items were added:

- **Open Graph / Twitter Card tags** on all 7 main pages — when the site is
  shared on WhatsApp, Instagram bio links, X, etc., it now shows a proper
  title, description, and preview image instead of a bare link. Each page
  uses a real photo already on that page as its preview image.
- **`sitemap.xml`** and **`robots.txt`** — helps Google (and other search
  engines) discover and index all 7 pages properly. If you ever add a
  custom domain, update the URLs inside `sitemap.xml` and `robots.txt` to
  match (they currently point to `off-pitch-nine.vercel.app`).
- **`privacy.html`** — a real, accurate privacy policy describing exactly
  what this site collects (contact form + chat messages, nothing else — no
  cookies, no analytics) and where that data goes (Formspree for the
  contact form, Anthropic's API for chat). Linked in the footer of every
  page.
- **`404.html`** — a branded "page not found" screen instead of Vercel's
  generic default, shown automatically for any broken/mistyped link.

### One more manual step: Formspree autoresponder

Right now, when someone submits your contact form, **you** get notified —
but **they** don't get any confirmation email of their own. Formspree can
send one automatically:

1. Log into [formspree.io](https://formspree.io) → open your form
2. Go to the **Workflow** tab → under "Actions" click **+ Add New** → choose
   **Auto Response**
3. Set a from-name (e.g. "Off Pitch Africa"), a subject (e.g. "We got your
   message!"), and a short thank-you message
4. Save — this works automatically since the form already has a field
   named `email`, which Formspree requires for autoresponses to work

