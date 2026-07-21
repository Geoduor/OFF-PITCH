# Off Pitch Africa — Website

A one-page marketing site for Off Pitch Africa with two working "agentic" pieces:

1. A **contact form** that actually emails you (via Formspree — no backend needed).
2. An **AI chat assistant** on the site that answers visitor questions using only
   real facts about Off Pitch Africa (via a small serverless function that calls
   the Anthropic API).

Both pieces need a few minutes of setup before they're "live" — a static HTML
file alone can't send emails or call an AI model securely. Follow the steps
below in order.

---

## 1. Folder structure

```
/
├── index.html          the website
├── package.json         minimal project file (for deployment)
├── assets/               logo + photos used on the site
│   └── ...
└── api/
    └── chat.js           serverless function that powers the chat assistant
```

Keep this exact structure when you upload/deploy — `index.html` expects
`assets/...` and `/api/chat` to be reachable relative to itself.

---

## 2. Set up the contact form (Formspree — free)

1. Go to https://formspree.io and create a free account.
2. Create a new form. Formspree gives you a form ID that looks like `mjaybnzk`.
3. Open `index.html`, find this line (inside the `#contactForm` section, near
   "Ready to tell your story?"):

   ```html
   <form id="contactForm" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
   ```

4. Replace `YOUR_FORM_ID` with the ID Formspree gave you.
5. In Formspree's dashboard, set the notification email to
   `offpitchafrica@gmail.com` (or wherever you want submissions to land).

That's it — once deployed, the form submits without a page reload and shows
a "Thanks — we'll be in touch soon" message. No server code required for this
part.

---

## 3. Set up the AI chat assistant

The chat widget (bottom-right bubble) calls `/api/chat`, a serverless
function in `api/chat.js`. This function calls Anthropic's API on the
server side, so your API key is never exposed to visitors. This requires
deploying to a host that supports serverless functions — **Vercel** is the
simplest (free tier is enough for a site like this).

### Deploy to Vercel

1. Create a free account at https://vercel.com.
2. Install the Vercel CLI (needs Node.js installed):
   ```
   npm install -g vercel
   ```
3. From inside this project folder, run:
   ```
   vercel
   ```
   and follow the prompts (accept defaults) to create and deploy the project.
4. In the Vercel dashboard → your project → **Settings → Environment
   Variables**, add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key (create one at https://console.anthropic.com)
5. Redeploy (`vercel --prod`) so the function picks up the new environment
   variable.

Once deployed, the chat bubble will answer questions using only the facts
written into `api/chat.js` (mission, services, contact info) — it's told to
say "I'm not sure" and point to your contact details rather than make things
up if it doesn't know something.

### If you'd rather use Netlify instead of Vercel

The function needs to move to `netlify/functions/chat.js` and be called from
the frontend as `/.netlify/functions/chat` instead of `/api/chat` (one line
to change in `index.html`). Netlify also uses environment variables under
**Site settings → Environment variables**. Ask me if you'd like this
converted.

### Cost note

Each chat message triggers one small Anthropic API call (using the fast
`claude-haiku-4-5` model to keep costs low). Check current pricing at
https://docs.claude.com before launching if you expect high traffic.

---

## 4. Local preview (without the chat backend)

You can open `index.html` directly in a browser to check the design any
time. The contact form and chat assistant won't fully work until deployed
(the form needs your live Formspree ID, and `/api/chat` only exists once
deployed to Vercel/Netlify with the API key set) — you'll see a friendly
fallback message in the chat widget if it can't reach the backend.

---

## 5. What's real vs. what you need to add

Everything on the page (mission, vision, values, services, contact info,
photos, logo, and social links) comes directly from the Off Pitch Africa
company profile and your live Linktree (linktr.ee/off_pitch) — nothing was
invented. Social accounts linked on the site:

- Instagram: https://www.instagram.com/offpitchafrica/
- YouTube: https://www.youtube.com/@offpitchAfrica
- TikTok: https://www.tiktok.com/@podcastoffpitch
- X: https://x.com/PodcastoffPitch
- Facebook: https://www.facebook.com/OffPitchAfrica
- Off Pitch Podcast (Spotify): https://podcasters.spotify.com/pod/show/off-pitch-podcast
- WhatsApp: https://wa.me/254704107373

If any of these accounts change, update the links in `index.html` (search
for "social-pill" and "contact-item") and in the assistant's knowledge in
`api/chat.js` (the `SYSTEM_PROMPT` constant) so the chat widget stays
accurate.

The only things you must supply yourself:

- Your Formspree form ID (step 2)
- Your Anthropic API key, added as an environment variable on your host
  (step 3) — never paste it into `index.html` or `chat.js` directly
