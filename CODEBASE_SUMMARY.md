# Off Pitch Africa Codebase Summary (Updated)

## Project Overview
A 9-page, plain HTML/CSS/JS marketing website for **Off Pitch Africa** — a Kenyan sports media and storytelling platform founded by Bonphace Odhiambo Otieno. Deployed on Vercel with no frameworks, no build step, and no database.

## Key Changes This Session

### Partner Logos Added
- Added **Mombasa County Hockey Association** (`assets/img/Mombasa.jpeg`) and **Mombasa Sports Club** (`assets/img/MSC Logo.png`) to the partners div across all 8 site pages (`about.html`, `blog.html`, `contact.html`, `events.html`, `gallery.html`, `index.html`, `merch.html`, `privacy.html`).
- Updated `.foot-partners-grid` in `assets/css/style.css` (`max-width: 960px`) so all 5 partner tiles display cleanly on desktop and wrap smoothly on mobile.
- Also placed copies in `assets/img/partners/` for directory consistency.

### Image & Event Updates
- Replaced deleted `IMG_6275.JPG.jpeg` with `assets/img/events/OFFPITCH Mombasa.jpeg` across `events.html` and `data/events.json`.
- Updated Mombasa Edition event details in `data/events.json` and `events.html` (Thursday, 8th October 2026, 1:00 PM – 6:00 PM at Mombasa Sports Club).
- Updated `index.html` events teaser card to spotlight the upcoming Mombasa Edition event on 8 October.

### Bug Fixes & Codebase Health
- **Fixed HTML tag mismatch**: Resolved broken unclosed tags in `events.html` where sections and wrappers were mismatched.
- **Removed CSP-violating inline script**: Removed inline script from `events.html` to strictly conform to Vercel CSP rules (`script-src 'self'`).
- **Fixed 404 Favicons**: Generated missing favicon assets (`favicon-16.png`, `favicon-180.png`, `favicon-192.png`) from high-res logo.
- **Fixed Clean URLs**: Standardized `contact.html#partner` to `/contact#partner` in `merch.html` and `privacy.html`.
- **Updated Reference Facts**: Added new partners and Mombasa Edition event to `AGENT.md` and `api/chat.js` assistant system prompt.

## Codebase Rules Observed
- ✅ No fabrication — all events from real sources or JSON
- ✅ Content in JSON files serves as database
- ✅ Admin dashboard commits to GitHub → Vercel auto-deploys
- ✅ CSS variables used consistently (--pitch-red, --navy, --chalk, etc.)
- ✅ Responsive design at 900px and 520px breakpoints
- ✅ No new binary assets committed without manual placement

## Pages & Their Purposes
| Page | Purpose |
|------|---------|
| `index.html` | Home with hero, social feed, featured cards, events teaser |
| `events.html` | Events & Fixtures — now with upcoming/past filtering |
| `about.html` | Mission, vision, founder + 6 services |
| `gallery.html` | Filterable photo grid + videos |
| `merch.html` | 4 products with pricing |
| `blog.html` | Substack posts with in-page reader |
| `contact.html` | Contact form + details |
| `privacy.html` | Privacy policy |
| `404.html` | Branded error page |

## Key Files Modified This Session
- `events.html` — Upcoming/past event filtering + Mombasa event added
- `data/events.json` — New Mombasa event entry
- `assets/js/main.js` — parseEventDate() function added
- `vercel.json` — deployment protection noted

## What Users See on events.html
1. **"What's Next"** heading immediately followed by Mombasa event card (upcoming)
2. Full fixtures & results section below (unchanged)
3. "Past Events ▶" accordion at bottom (collapsed by default)
4. Clicking accordion reveals the August 29 "Off The Pitch" event
5. Grid only shows upcoming events — keeps page clean and professional

All changes maintain the project's design system, CSS variables, and responsive patterns established throughout the codebase.