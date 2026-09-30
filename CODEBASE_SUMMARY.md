# Off Pitch Africa Codebase Summary (Updated)

## Project Overview
A 9-page, plain HTML/CSS/JS marketing website for **Off Pitch Africa** — a Kenyan sports media and storytelling platform founded by Bonphace Odhiambo Otieno. Deployed on Vercel with no frameworks, no build step, and no database.

## Key Changes This Session

### events.html — Upcoming/Past Event Filtering
- **Removed** broken dynamic loading script that was disrupting page layout
- **Added** upcoming/past event filtering system:
  - "What's Next" heading now shows upcoming events in a responsive grid immediately below
  - "Past Events" accordion at bottom (hidden by default, toggleable ▶/▼)
  - JavaScript automatically categorizes events by date (future vs past)
- **New Mombasa event** displayed: "OFF THE PITCH ON THE RECORD Mombasa Edition" — Oct 8, 2026
- **Past event auto-moved**: "Off The Pitch, On The Record" (Aug 29, 2026) goes to accordion
- Original detailed event section preserved (full program, speakers, etc.)

### Data Updates
- **data/events.json**: Added "off-the-pitch-mombasa-2026" event entry
- **assets/js/main.js**: Added `parseEventDate()` function for date filtering (used by index.html events section)

### Deployment
- Production: https://offpitchafrica.com (aliased)
- All changes live via `vercel --prod`

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