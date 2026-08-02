# Off Pitch Africa — Security Overview

This document explains what's actually in place, why, and — just as
important — what genuinely doesn't apply to a site like this and why, so
nothing here is padding. It's organized around the five areas you asked
about, plus a section on things you didn't ask about but should know.

**Context that shapes everything below:** this is a static 5-page site with
two small serverless functions (`api/chat.js`, `api/social-feed.js`). There
is no database, no user accounts, and no server you manage yourself — Vercel
runs the functions, Formspree runs the contact form. That changes which
classic security concerns are relevant.

---

## 1. Authentication & Authorization

**Update (this session): the admin dashboard added a real login.** Before
this, there was no login system anywhere on the site. Now `/admin.html` has
one, described fully below — everything else in this section (protecting
your various account logins) is still accurate and still matters just as
much.

### Admin dashboard login (`admin.html` / `api/admin.js`)

- A single shared password (`ADMIN_PASSWORD` env var) — there are no
  individual user accounts, since this is a one-operator dashboard.
- On successful login, the server issues a signed session token (HMAC-SHA256,
  keyed with `ADMIN_SESSION_SECRET`) stored as an **HttpOnly, Secure,
  SameSite=Strict** cookie — JavaScript on the page can't read it, and it
  won't be sent cross-site. Sessions expire after 12 hours.
- Every request to `/api/admin` other than login/logout/check re-verifies
  that signature server-side — a forged or tampered cookie is rejected, not
  trusted.
- Login attempts are rate-limited per IP (8/minute, same best-effort
  in-memory approach as the chat endpoint — see the Rate Limiting section
  below for the caveat).
- `GITHUB_TOKEN` (used to commit content changes) never reaches the browser
  — it's read from an environment variable and used only inside
  `api/admin.js`, server-side.
- The token itself should be scoped as narrowly as possible: a **fine-grained
  GitHub PAT** limited to this one repository, with only "Contents:
  Read and write" permission — not a classic token with full account access.

**Pre-existing accounts to protect (still applies):**

| Account | Why it matters | What to do |
|---|---|---|
| Vercel | Controls your live deployment | Enable 2FA, use a strong unique password |
| Anthropic Console | Holds your API key + billing | Enable 2FA, restrict key if possible |
| Google Cloud | Holds your YouTube API key | You already have MFA enforced (Google required this) |
| Meta for Developers | Holds Instagram/Facebook tokens | Enable 2FA on the Facebook account behind it |
| Formspree | Receives contact form submissions | Enable 2FA if offered |
| GitHub | Holds your source code + now the admin dashboard's write access | Enable 2FA — this one matters more now than before |

**Authorization** (who can do what): there's one dashboard operator (you)
and no visitor accounts. Nobody except you should know the dashboard
password or have write access to the Vercel project/environment variables.
If you ever bring on help, give them their own GitHub PAT rather than
sharing `GITHUB_TOKEN`, and consider a separate `ADMIN_PASSWORD` you can
rotate independently of theirs.

---

## 2. Data Security

- **No database** — nothing is stored persistently on your infrastructure.
  Contact form submissions go straight to Formspree over HTTPS; chat
  messages are sent to Anthropic for a single reply and never stored
  anywhere in between.
- **Secrets** (Anthropic key, YouTube key, Instagram/Facebook tokens) live
  only as Vercel environment variables — never in the code, never in the
  repo, never sent to the browser. This was already true; I didn't need to
  change anything here, just confirming it's correct practice.
- **HTTPS everywhere**: Vercel serves everything over TLS automatically. The
  new `Strict-Transport-Security` header (see section 3) tells browsers to
  *never* fall back to plain HTTP for this site, even if someone types
  `http://` by mistake.
- **No tracking, no cookies, no analytics script** currently on the site —
  so there's no visitor data being collected at all right now, which
  sidesteps a whole category of privacy/data-protection concerns. If you add
  analytics later, that's worth revisiting (cookie consent, privacy policy).

---

## 3. Attack Prevention

### SQL Injection — not applicable
There is no SQL database anywhere in this stack, so this specific attack
class has no surface to exploit. I'm noting this explicitly rather than
adding fake "protection" against something that can't happen here.

### Cross-Site Scripting (XSS)
- Every place the chat widget and live social feed write text into the page
  already used `.textContent` (not `.innerHTML`), which was already safe —
  browsers never interpret `.textContent` as HTML/script.
- The one place that *was* a real gap: images and links pulled from
  Instagram/Facebook/YouTube's APIs get written into `<img src>` and
  `<a href>`. If any of those platforms ever returned something malformed
  (or if their API were ever compromised), an attacker-controlled
  `javascript:` URL could theoretically end up there. **Fixed**: both
  `api/social-feed.js` (server-side) and `assets/js/main.js` (client-side,
  belt-and-suspenders) now validate that every URL is a well-formed
  `https://` link before it's ever used — anything else is silently dropped.
- Added a **Content-Security-Policy** header (see below) as a second layer:
  even if a script injection somehow slipped through, the browser would
  refuse to execute it because the policy only allows scripts from the
  site's own origin.

### CSRF (Cross-Site Request Forgery)
Classic CSRF exploits a logged-in user's session to forge a request on
their behalf — since there are no user sessions or logged-in states
anywhere on this site, the traditional CSRF threat model doesn't apply.
The contact form posts directly to Formspree (a separate origin by design),
and Formspree handles their own submission integrity on their end.

What **does** apply and is now handled: **restricting who can call your own
API endpoints**. Added CORS restrictions to both `api/chat.js` and
`api/social-feed.js` so only requests from your own site's origin succeed —
plus a server-side origin check that also blocks non-browser scripted
requests claiming a different origin.

### Input Sanitization / Validation
- `api/chat.js`: messages are now capped at 1000 characters, must be a
  non-empty string, and conversation history is capped both in count (10
  messages) and per-message length. Previously there was no length limit at
  all — someone could have sent a massive payload to run up your Anthropic
  bill or overwhelm the function.
- The contact form now has `maxlength` limits on every field, plus two
  layers of bot protection:
  - A **honeypot field** (`_gotcha`) — invisible to real people, but bots
    that blindly fill in every form field will fill it in too, letting
    Formspree quietly discard the submission.
  - A **bot-speed trap** — the form stamps the moment it loaded, and blocks
    submission if it comes back in under ~2.5 seconds. Real people need at
    least that long to read the form and type a message; scripted bots
    almost always submit instantly.
- **Verified directly from Formspree's own security page** (not assumed):
  Formspree is **SOC 2 Type 2** audited, **GDPR/CCPA compliant**, encrypts
  data at rest with **AES-256**, uses **TLS 1.2+** in transit, is hosted on
  AWS, and runs a Web Application Firewall with active threat monitoring.
  This is now stated directly on the contact page itself (with a link to
  their security page) so partners submitting sensitive info can see it.
- **Recommended next step for even stronger spam/bot protection:**
  Formspree supports invisible Google reCAPTCHA v3 scoring, which needs a
  free Google reCAPTCHA key (2-minute signup at
  google.com/recaptcha/admin) plus pasting the secret key into your
  Formspree form settings. I didn't wire this in yet since it needs your
  own Google account — happy to build it the same way we did the other
  integrations once you're ready.

### Rate Limiting
This was a real, meaningful gap — nothing stopped someone from scripting
thousands of requests to `/api/chat` (burning through your Anthropic
billing) or `/api/social-feed` (risking your YouTube/Instagram/Facebook API
quotas getting throttled).

**What I added:** a lightweight rate limiter in both functions — 12
requests/minute per IP for chat, 30/minute for the social feed. Honest
limitation: this uses in-memory storage inside the serverless function,
which resets whenever the function "cold starts" (a fresh instance spins
up) and isn't shared across multiple concurrent instances under real load.
It's a genuine speed bump against casual/scripted abuse, **not** a
guarantee against a determined or high-volume attacker.

**For real production-grade rate limiting**, the standard approach is
[Upstash Redis](https://upstash.com) (free tier is generous) with their
`@upstash/ratelimit` package, which persists counts across every request
regardless of which serverless instance handles it. I didn't wire this in
because it needs its own account/credentials (same pattern as the
YouTube/Instagram setup) — happy to build it if you want the stronger
version.

### Clickjacking
Added `X-Frame-Options: DENY` and the CSP `frame-ancestors 'none'` directive
— together they stop any other website from embedding your site inside a
hidden `<iframe>` to trick visitors into clicking something they didn't mean
to.

### MIME-sniffing
Added `X-Content-Type-Options: nosniff` — stops browsers from
second-guessing a file's declared type in ways that have historically been
exploited to execute disguised scripts.

---

## 4. Infrastructure Security

- **Hosting**: Vercel handles TLS/HTTPS certificates, basic DDoS
  mitigation, and network isolation between serverless function
  invocations automatically — no action needed from you there.
- **Principle of least privilege on API keys**: the YouTube API key is
  already restricted to only the YouTube Data API (we set that up earlier).
  When you set up Instagram/Facebook tokens, request only the specific
  permissions needed (e.g., `instagram_basic`, `pages_read_engagement`) —
  not broader access "just in case."
- **No dependencies to go stale**: `package.json` has zero npm packages
  installed, so there's no third-party dependency supply chain to monitor
  for this project (a real, if unusual, security advantage — most sites
  accumulate dozens of dependencies, each a potential vulnerability).
- **Secrets never touch the repository**: environment variables live only
  in Vercel's dashboard. If you ever add a `.env` file locally for testing,
  make sure it's listed in a `.gitignore` file so it's never accidentally
  committed.
- **Security headers applied globally** via the new `vercel.json` — this is
  infrastructure-level configuration, not per-page code, so it can't be
  accidentally forgotten on a new page later.

---

## 5. Security Monitoring

- **Vercel's Function Logs** (Dashboard → your project → Deployments →
  latest → Logs) show every request to `/api/chat` and `/api/social-feed`,
  including errors. Worth a periodic glance for unusual spikes or repeated
  errors — this is also where you'd spot rate-limit triggers piling up,
  which would suggest someone's probing the endpoints.
- **Anthropic Console usage page** (console.anthropic.com) shows your
  actual API spend day-by-day — check this occasionally once billing is
  active, since an unexpected spike is the clearest signal of abuse.
- **Google Cloud quota dashboard** and **Meta App Dashboard** similarly show
  API call volume for YouTube/Instagram/Facebook — same idea.
- **Recommended add-on (free, no code needed):** a free uptime monitor like
  [UptimeRobot](https://uptimerobot.com) can ping your site every few
  minutes and email/text you if it goes down — useful since you won't
  always be watching it yourself.

---

## What I added beyond your list

- **Content-Security-Policy (CSP)** — the single highest-leverage header
  for XSS prevention. It tells the browser exactly which sources are
  allowed to supply scripts, styles, fonts, and images, and refuses
  everything else, even if some other protection fails.
- **Referrer-Policy** (`strict-origin-when-cross-origin`) — stops the full
  URL of pages people are viewing from leaking to third-party sites via the
  `Referer` header (e.g., if a page ever had something sensitive in its URL).
- **Permissions-Policy** — explicitly disables browser features this site
  never uses (camera, microphone, geolocation, payment APIs, USB) so they
  can't be silently invoked by any script that somehow got injected.
- **Removed the legacy `X-XSS-Protection` header's old behavior** by
  explicitly setting it to `0`. This might look backwards, but it's the
  current OWASP/Mozilla recommendation — that old header had its own
  exploitable bugs in some browsers and is superseded entirely by CSP.

---

## What's still on you (things I can't set up remotely)

1. **Enable 2FA** on Vercel, Anthropic, Meta, Formspree, and GitHub (if
   used) — this is the single highest-impact action left, and I can't do it
   for you since it requires your phone/authenticator app.
2. **Anthropic billing/credit** (from earlier in our conversation) — still
   needed for the chat assistant to respond at all.
3. **Enable Formspree's spam filter** in their dashboard (a toggle, not code).
4. **Optional: Upstash rate limiting** if you want the stronger,
   production-grade version instead of the in-memory speed bump — let me
   know if you want this built.
5. **Periodically check the monitoring dashboards** listed in section 5 —
   security monitoring only works if someone occasionally looks at it.

---

## Files changed in this pass

- `vercel.json` — new file, global security headers
- `api/chat.js` — CORS restriction, input validation, rate limiting, safer errors
- `api/social-feed.js` — CORS restriction, rate limiting, URL sanitization
- `assets/js/main.js` — client-side URL validation, message length guard, friendlier rate-limit message, contact form bot-speed trap
- `assets/css/style.css` — trust note styling
- `contact.html` — field length limits, honeypot spam trap, bot-speed trap field, visible trust/security note citing Formspree's verified compliance
- `index.html`, `about.html`, `services.html`, `gallery.html`, `contact.html` — `maxlength` on chat input
