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
├── contact.html           Contact (working form + all contact details)
├── package.json           minimal project file (for deployment)
├── assets/
│   ├── css/style.css       shared styles for all 5 pages
│   ├── js/main.js          shared behavior: nav, chat widget, form, gallery filter
│   └── img/                logo + photos
└── api/
    └── chat.js             serverless function powering the AI chat assistant
```

Keep this exact structure when you upload/deploy. Every page links to
`assets/css/style.css`, `assets/js/main.js`, and images under `assets/img/`
using relative paths — so the folder layout must stay intact.

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
- **Watch row video thumbnails** currently reuse your existing photos as
  placeholders and link out to your YouTube channel — they don't claim to be
  actual video stills. Send real video thumbnails/screenshots any time and
  we'll swap them in.
- **Gallery** uses the same photos from your company profile; add higher-res
  or additional event photos any time by dropping them into `assets/img/`
  and adding a `<div class="hexcell">` entry in `gallery.html`.

The only setup items still on you:

- Anthropic billing/credit for the chat assistant to actually respond
  (see prior conversation — console.anthropic.com → Plans & Billing)
- The social media slideshow feed (below) needs its own API credentials

---

## 6. Live social slideshow (Home page hero)

The Home page hero background is now a slideshow that cross-fades between
your **actual recent photos from YouTube, Instagram, and Facebook** —
pulled live via each platform's official API (not scraping). It's powered
by `api/social-feed.js`, called by the browser every time someone loads the
Home page.

**Nothing breaks if you skip this setup** — the hero just shows your
existing static photo until you add credentials. Each platform is
independent: configure just YouTube, or just Instagram, or all three.

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

