// Off Pitch Africa — shared site behavior (nav, chat widget, contact form)

// PERFORMANCE: both the Google Fonts stylesheet AND our own site.css are
// loaded with media="print" in each page's <head> — a well-established
// technique that lets the browser fetch them WITHOUT blocking initial
// render (print stylesheets don't block screen rendering). A hand-picked
// "critical CSS" block (inlined directly above, covering the header, nav,
// and whichever hero this page uses) renders the visible-without-scrolling
// content instantly, while the full stylesheet loads in the background and
// gets swapped in the moment it's ready — usually near-instant since it's
// been downloading in parallel the whole time. Runs immediately (not
// inside DOMContentLoaded) so both swaps happen as early as possible.
(function swapNonBlockingStylesheets() {
  const fontsLink = document.getElementById('gfonts-link');
  if (fontsLink) fontsLink.media = 'all';
  const siteCss = document.getElementById('site-css');
  if (siteCss) siteCss.media = 'all';
})();

/* ---------- Cookie consent (gates GA4 until the visitor decides) ----------
   GDPR/Kenya Data Protection Act: analytics cookies must not fire before
   consent. GA4 is NEVER loaded via a static <script> tag in any page's
   <head> anymore — it only ever loads from here, and only after Accept
   (or a prior "accepted" preference already in localStorage). Preference
   is stored under OPA_CONSENT_KEY as 'accepted' | 'rejected'. Runs
   immediately (not inside DOMContentLoaded) so returning consenting
   visitors get GA4 as early as possible — same reasoning as the
   stylesheet swap above. */
const OPA_CONSENT_KEY = 'opa_cookie_consent';

function opaGetConsent() {
  try { return localStorage.getItem(OPA_CONSENT_KEY); } catch { return null; }
}
function opaSetConsent(value) {
  try { localStorage.setItem(OPA_CONSENT_KEY, value); } catch { /* private mode etc. */ }
}
function opaLoadGA4() {
  if (window.__opaGaLoaded) return;
  window.__opaGaLoaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-DBL7XJFFQL';
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-DBL7XJFFQL');
}

if (opaGetConsent() === 'accepted') opaLoadGA4();

// Exposed so a "Cookie preferences" link (e.g. in the footer) can let a
// visitor reopen the banner and change their mind later.
window.OPA_openCookieSettings = function () {
  try { localStorage.removeItem(OPA_CONSENT_KEY); } catch { /* ignore */ }
  const existing = document.querySelector('.cookie-banner');
  if (existing) existing.remove();
  opaRenderCookieBanner();
};

function opaRenderCookieBanner() {
  if (opaGetConsent()) return; // already decided, nothing to show
  if (document.querySelector('.cookie-banner')) return; // already showing

  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie preferences');
  banner.innerHTML = `
    <div class="cookie-banner-inner">
      <p class="cookie-banner-text">
        We use cookies for analytics. <a href="/privacy">Privacy Policy</a>
      </p>
      <div class="cookie-banner-actions">
        <button type="button" class="btn btn-ghost cookie-btn-manage">Manage</button>
        <button type="button" class="btn btn-ghost cookie-btn-reject">Reject</button>
        <button type="button" class="btn btn-primary cookie-btn-accept">Accept</button>
      </div>
      <div class="cookie-manage-panel">
        <label class="cookie-toggle-row">
          <span>Strictly necessary <em>(always on)</em></span>
          <input type="checkbox" checked disabled>
        </label>
        <label class="cookie-toggle-row">
          <span>Analytics</span>
          <input type="checkbox" class="cookie-analytics-toggle">
        </label>
        <button type="button" class="btn btn-primary cookie-btn-save">Save preferences</button>
      </div>
    </div>`;
  document.body.appendChild(banner);

  function closeBanner() { banner.remove(); }

  banner.querySelector('.cookie-btn-accept').addEventListener('click', () => {
    opaSetConsent('accepted');
    opaLoadGA4();
    closeBanner();
  });
  banner.querySelector('.cookie-btn-reject').addEventListener('click', () => {
    opaSetConsent('rejected');
    closeBanner();
  });
  banner.querySelector('.cookie-btn-manage').addEventListener('click', () => {
    banner.querySelector('.cookie-manage-panel').classList.toggle('is-open');
  });
  banner.querySelector('.cookie-btn-save').addEventListener('click', () => {
    const wantsAnalytics = banner.querySelector('.cookie-analytics-toggle').checked;
    opaSetConsent(wantsAnalytics ? 'accepted' : 'rejected');
    if (wantsAnalytics) opaLoadGA4();
    closeBanner();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  opaRenderCookieBanner();

  /* ---------- Footer "Cookie Preferences" link ---------- */
  const footerCookiePrefs = document.getElementById('footerCookiePrefs');
  if (footerCookiePrefs) {
    footerCookiePrefs.addEventListener('click', () => window.OPA_openCookieSettings());
  }
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Mobile nav toggle (slide-in drawer) ---------- */
  const burger = document.getElementById('navBurger');
  const navlinks = document.getElementById('navLinks');
  const navClose = document.getElementById('navClose');
  const navOverlay = document.getElementById('navOverlay');

  function setNavOpen(open) {
    if (!navlinks || !burger) return;
    navlinks.classList.toggle('open', open);
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    if (navOverlay) navOverlay.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }

  if (burger && navlinks) {
    burger.addEventListener('click', () => {
      setNavOpen(!navlinks.classList.contains('open'));
    });
    navlinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => setNavOpen(false));
    });
    if (navClose) navClose.addEventListener('click', () => setNavOpen(false));
    if (navOverlay) navOverlay.addEventListener('click', () => setNavOpen(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setNavOpen(false);
    });
  }

  /* ---------- Contact form (Formspree) ---------- */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    // Bot-speed trap: stamp the moment the form became interactive. A real
    // person needs at least a couple seconds to read the form and type a
    // message; a script submitting instantly on page load is almost always
    // a bot. This is a heuristic, not a hard guarantee — paired with the
    // honeypot field and Formspree's own spam filtering (see SECURITY.md).
    const loadedAtField = document.getElementById('cf-loaded-at');
    if (loadedAtField) loadedAtField.value = String(Date.now());
    const MIN_FILL_TIME_MS = 2500;

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('formStatus');
      const btn = contactForm.querySelector('button[type="submit"]');

      if (loadedAtField && loadedAtField.value) {
        const elapsed = Date.now() - Number(loadedAtField.value);
        if (elapsed < MIN_FILL_TIME_MS) {
          status.textContent = 'Please take a moment to review your message, then try again.';
          status.style.color = '#ff8080';
          return;
        }
      }

      const originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending…';
      status.textContent = '';
      status.style.color = '#9aa0ad';

      try {
        const res = await fetch(contactForm.action, {
          method: 'POST',
          body: new FormData(contactForm),
          headers: { Accept: 'application/json' }
        });
        if (res.ok) {
          contactForm.reset();
          if (loadedAtField) loadedAtField.value = String(Date.now());
          status.textContent = "Thanks — we'll be in touch soon.";
          status.style.color = 'var(--signal-teal)';
        } else {
          status.textContent = 'Something went wrong. Please email us directly.';
          status.style.color = '#ff8080';
        }
      } catch (err) {
        status.textContent = 'Network error. Please email us directly.';
        status.style.color = '#ff8080';
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  }

  /* ---------- Gallery filter (if present) ---------- */
  const filterPills = document.querySelectorAll('.filter-pill');
  if (filterPills.length) {
    function applyGalleryFilter(filter) {
      document.querySelectorAll('.gallery-item').forEach(cell => {
        const show = filter === 'all' || cell.dataset.category === filter;
        cell.style.display = show ? '' : 'none';
      });
    }

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        applyGalleryFilter(pill.dataset.filter);
      });
    });
  }

  /* ---------- Live stream banner (index.html only) ----------
     Two independent sources, checked together:
     1. YouTube — auto-detected via /api/live-status (needs YOUTUBE_API_KEY;
        silently reports not-live if that's not configured yet).
     2. Facebook/Instagram/TikTok — manually toggled on/off from the admin
        dashboard's "Live" tab (data/live.json), since those platforms don't
        offer a simple way to auto-detect or embed a live stream. */
  const liveBanner = document.getElementById('liveBanner');
  if (liveBanner) {
    const LIVE_POLL_MS = 120000; // safe to poll often client-side — the API response itself is edge-cached

    function renderYouTubeLive(videoId, title) {
      liveBanner.innerHTML = `
        <div class="live-banner-inner">
          <div class="live-badge"><span class="dot"></span>Live Now</div>
          <p class="live-title">${escapeHtml(title || 'Watch our live broadcast')}</p>
          <div class="live-embed-wrap">
            <iframe src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=0" title="Live stream" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
          </div>
        </div>`;
      liveBanner.hidden = false;
    }

    function renderManualLive(manual) {
      const platformLabel = manual.platform ? escapeHtml(manual.platform) : 'social media';
      liveBanner.innerHTML = `
        <div class="live-banner-inner">
          <div class="live-badge"><span class="dot"></span>Live Now on ${platformLabel}</div>
          <div class="live-link-row">
            <p class="live-title" style="margin-bottom:0;">${escapeHtml(manual.label || `We're streaming live on ${platformLabel} right now.`)}</p>
            <a href="${escapeHtml(manual.url)}" target="_blank" rel="noopener" class="btn btn-primary">Watch Live →</a>
          </div>
        </div>`;
      liveBanner.hidden = false;
    }

    function hideLiveBanner() {
      liveBanner.hidden = true;
      liveBanner.innerHTML = '';
    }

    function checkLiveStatus() {
      Promise.all([
        fetch('/api/live-status').then(r => r.ok ? r.json() : { live: false }).catch(() => ({ live: false })),
        fetch('/data/live.json').then(r => r.ok ? r.json() : { active: false }).catch(() => ({ active: false }))
      ]).then(([yt, manual]) => {
        if (yt && yt.live && yt.videoId) {
          renderYouTubeLive(yt.videoId, yt.title);
        } else if (manual && manual.active && manual.url) {
          renderManualLive(manual);
        } else {
          hideLiveBanner();
        }
      }).catch(() => hideLiveBanner());
    }

    checkLiveStatus();
    setInterval(checkLiveStatus, LIVE_POLL_MS);
  }

  /* ---------- Dynamic content: Events / Gallery / Videos / Blog ----------
     Each of these reads a small static JSON file (edited via the admin
     dashboard, which commits straight to GitHub) and rebuilds its section.
     If the fetch fails or the file is missing, the real static markup
     already in the page (marked data-fallback="true") stays untouched —
     same fail-safe pattern already used for the social feed above. */

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

// Parses event date strings like "Saturday, 29th August 2026" or "Wednesday, 8th October 2026"
function parseEventDate(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthAbbr = m[2].slice(0, 3).toLowerCase();
  const monthIdx = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(monthAbbr);
  if (monthIdx === -1) return null;
  const year = m[3];
  return { day, monthIdx, year };
}

// --- Events (index.html) ---
  const eventsList = document.getElementById('eventsList');
  if (eventsList && eventsList.dataset.staticOnly !== 'true') {
    fetch('/data/events.json')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const events = Array.isArray(data)
          ? data.filter(e => {
              if (!e || e.active === false) return false;
              // "What's Next" is for flagship events only. Season-calendar
              // placeholders (KHU tournaments etc.) have no poster/time and
              // must not render here — they're opted in via "spotlight".
              if (e.spotlight !== true) return false;
              if (!e.title || !e.date) return false;
              const parsed = parseEventDate(e.date);
              if (!parsed) return false; // No parseable date → exclude (show static fallback)
              const eventDate = new Date(parsed.year, parsed.monthIdx, parsed.day);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return eventDate >= today; // Only show future-dated events
            })
          : [];
        const section = document.getElementById('events');
        if (events.length === 0) {
          if (section) section.style.display = 'none';
          return;
        }
        eventsList.innerHTML = '';
        events.forEach(ev => {
          const card = document.createElement('div');
          card.className = 'events-card';
          const imgSrc = ev.image ? escapeHtml(ev.image) : 'assets/img/logo.webp';
          const tel = ev.phone ? `<a href="tel:${escapeHtml(ev.phone)}" class="btn btn-primary">Call To Register →</a>` : '';
          const mail = ev.email ? `<a href="mailto:${escapeHtml(ev.email)}" class="btn btn-ghost">Email Us</a>` : '';
          const registerBtn = ev.registerLink
            ? `<a href="${escapeHtml(ev.registerLink)}" target="_blank" rel="noopener" class="btn btn-primary">Register →</a>`
            : tel;
          const videoBlock = ev.video
            ? `<video class="ev-video" controls autoplay muted loop preload="auto" playsinline${ev.videoPoster ? ` poster="${escapeHtml(ev.videoPoster)}"` : ''}><source src="${escapeHtml(ev.video)}" type="video/mp4">Your browser doesn't support video playback.</video>`
            : '';
          card.innerHTML = `
            <img src="${imgSrc}" alt="${escapeHtml(ev.title)} event poster" loading="lazy">
            ${videoBlock}
            <div class="ev-body">
              <h3 class="ev-title">${escapeHtml(ev.title)}</h3>
              ${ev.theme ? `<p class="ev-theme">${escapeHtml(ev.theme)}</p>` : ''}
              <ul class="ev-list">
                <li><strong>Date:</strong> ${escapeHtml(ev.date)}</li>
                ${ev.time ? `<li><strong>Time:</strong> ${escapeHtml(ev.time)}</li>` : ''}
                ${ev.venue ? `<li><strong>Venue:</strong> ${escapeHtml(ev.venue)}</li>` : ''}
              </ul>
              <div class="ev-ctas">${registerBtn}${ev.registerLink ? '' : mail}</div>
            </div>`;
          eventsList.appendChild(card);
          // Browsers only autoplay muted video; set the property explicitly since
          // markup injected via innerHTML doesn't always register the attribute.
          const vid = card.querySelector('video.ev-video');
          if (vid) { vid.muted = true; const p = vid.play(); if (p && p.catch) p.catch(() => {}); }
        });
      })
      .catch(() => { /* keep static fallback */ });
  }

  // --- Gallery (gallery.html) ---
  const hexGrid = document.getElementById('hexGrid');
  if (hexGrid) {
    fetch('/data/gallery.json')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const photos = Array.isArray(data) ? data.filter(p => p && p.src) : [];
        if (photos.length === 0) return; // keep static fallback
        hexGrid.innerHTML = '';
        photos.forEach((p, i) => {
          const cell = document.createElement(p.link ? 'a' : 'div');
          cell.className = 'gallery-item';
          cell.dataset.category = p.category || 'community';
          if (p.link) {
            cell.href = p.link;
            cell.target = '_blank';
            cell.rel = 'noopener';
            cell.setAttribute('aria-label', p.alt || 'Open Off Pitch Africa event media');
          }
          const img = document.createElement('img');
          img.src = p.src;
          img.alt = p.alt || 'Off Pitch Africa';
          img.loading = 'lazy';
          img.decoding = 'async';
          if (p.width && p.height) { img.width = p.width; img.height = p.height; }
          cell.appendChild(img);
          if (p.caption) {
            const caption = document.createElement('span');
            caption.className = 'hex-caption';
            caption.textContent = p.caption;
            cell.appendChild(caption);
          }
          hexGrid.appendChild(cell);
        });
      })
      .catch(() => { /* keep static fallback */ });
  }

  // --- Gallery lightbox + photo count (gallery.html) ---
  if (hexGrid) {
    const lb = document.createElement('div');
    lb.className = 'opa-lb';
    lb.hidden = true;
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photo viewer');
    lb.innerHTML = '<span class="lb-pos"></span><button type="button" class="lb-close" aria-label="Close">&times;</button><button type="button" class="lb-prev" aria-label="Previous photo">&#8249;</button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="lb-next" aria-label="Next photo">&#8250;</button>';
    document.body.appendChild(lb);
    const lbImg = lb.querySelector('img');
    const lbCap = lb.querySelector('figcaption');
    const lbPos = lb.querySelector('.lb-pos');
    let current = [];
    let idx = 0;
    let lastFocus = null;

    const visibleCells = () => [...hexGrid.querySelectorAll('.gallery-item')]
      .filter(c => c.tagName !== 'A' && c.style.display !== 'none');
    function show(i) {
      idx = (i + current.length) % current.length;
      const img = current[idx].querySelector('img');
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt;
      lbCap.textContent = img.alt;
      lbPos.textContent = (idx + 1) + ' / ' + current.length;
    }
    function open(cell) {
      current = visibleCells();
      const i = current.indexOf(cell);
      if (i < 0) return;
      lastFocus = document.activeElement;
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      show(i);
      lb.querySelector('.lb-close').focus();
    }
    function close() {
      lb.hidden = true;
      document.body.style.overflow = '';
      lbImg.removeAttribute('src');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    hexGrid.addEventListener('click', e => {
      const cell = e.target.closest('.gallery-item');
      if (!cell || cell.tagName === 'A') return;
      open(cell);
    });
    hexGrid.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const cell = e.target.closest('.gallery-item');
      if (!cell || cell.tagName === 'A') return;
      e.preventDefault();
      open(cell);
    });
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', () => show(idx - 1));
    lb.querySelector('.lb-next').addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
    });
    let touchX = null;
    lb.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
      touchX = null;
    });

    // Make photo cells keyboard-focusable once they exist (also after the JSON render).
    const makeFocusable = () => hexGrid.querySelectorAll('.gallery-item').forEach(c => {
      if (c.tagName !== 'A') { c.tabIndex = 0; c.setAttribute('role', 'button'); }
    });
    makeFocusable();
    new MutationObserver(makeFocusable).observe(hexGrid, { childList: true });
  }

  // --- Gallery albums (gallery.html): one album per event, built from the photo cells ---
  if (hexGrid) {
    const ALBUMS = [
      { key: 'mombasa', cats: ['mombasa'], title: 'Mombasa Edition', sub: 'Off The Pitch, On The Record · 8 October 2026 · Mombasa Sports Club' },
      { key: 'nairobi', cats: ['event'], cover: 'assets/img/events/off-the-pitch-on-the-record.webp', title: 'Nairobi Forum', sub: 'Off The Pitch, On The Record · 29 August 2026 · Baraza Media Lab, Nairobi' },
      { key: 'moments', cats: ['hockey', 'community', 'celebration'], title: 'Off Pitch Moments', sub: 'Hockey, community and celebrations' }
    ];
    const albumGrid = document.getElementById('albumGrid');
    const albumHead = document.getElementById('albumHead');
    const cellsOf = album => [...hexGrid.querySelectorAll('.gallery-item')]
      .filter(c => album.cats.includes(c.dataset.category));

    function showAlbum(key) {
      const album = ALBUMS.find(a => a.key === key);
      if (!album) { showAlbums(); return; }
      hexGrid.querySelectorAll('.gallery-item').forEach(c => {
        c.style.display = album.cats.includes(c.dataset.category) ? '' : 'none';
      });
      document.getElementById('albumTitle').textContent = album.title;
      document.getElementById('albumSub').textContent = album.sub;
      albumGrid.hidden = true;
      albumHead.hidden = false;
      hexGrid.hidden = false;
    }
    function showAlbums() {
      albumGrid.hidden = false;
      albumHead.hidden = true;
      hexGrid.hidden = true;
    }
    function buildAlbums() {
      albumGrid.innerHTML = '';
      ALBUMS.forEach(album => {
        const cells = cellsOf(album);
        if (!cells.length) return;
        const cover = cells[0].querySelector('img');
        const card = document.createElement('a');
        card.className = 'album-card';
        card.href = '#' + album.key;
        const n = cells.filter(c => c.tagName !== 'A' || c.querySelector('img')).length;
        card.innerHTML = '<img alt="" loading="lazy"><span class="album-card-body"><span class="album-card-title"></span><span class="album-card-sub"></span><span class="album-card-count"></span></span>';
        card.querySelector('img').src = album.cover || cover.currentSrc || cover.src;
        card.querySelector('.album-card-title').textContent = album.title;
        card.querySelector('.album-card-sub').textContent = album.sub;
        card.querySelector('.album-card-count').textContent = n + ' photos';
        albumGrid.appendChild(card);
      });
    }
    function route() {
      const key = location.hash.replace('#', '');
      if (key) showAlbum(key); else showAlbums();
    }
    document.getElementById('albumBack').addEventListener('click', () => {
      history.pushState(null, '', location.pathname);
      showAlbums();
      albumGrid.scrollIntoView({ block: 'start' });
    });
    albumGrid.addEventListener('click', e => {
      const card = e.target.closest('.album-card');
      if (!card) return;
      e.preventDefault();
      history.pushState(null, '', card.getAttribute('href'));
      showAlbum(card.getAttribute('href').slice(1));
      albumHead.scrollIntoView({ block: 'start' });
    });
    window.addEventListener('popstate', route);
    window.addEventListener('hashchange', route);
    buildAlbums();
    route();
    // The photo list is re-rendered from data/gallery.json after load; rebuild covers/counts then.
    new MutationObserver(() => { buildAlbums(); route(); }).observe(hexGrid, { childList: true });
  }

  // --- Videos (videos.html) ---
  const videosGrid = document.getElementById('videosGrid');
  if (videosGrid) {
    fetch('/data/videos.json')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const videos = Array.isArray(data) ? data.filter(v => v && v.youtubeId) : [];
        if (videos.length === 0) return; // keep static fallback
        videosGrid.innerHTML = '';
        videos.forEach(v => {
          const a = document.createElement('a');
          a.href = `https://www.youtube.com/watch?v=${encodeURIComponent(v.youtubeId)}`;
          a.target = '_blank';
          a.rel = 'noopener';
          a.className = 'media-card';
          a.style.aspectRatio = '16/9';
          a.innerHTML = `
            <img src="https://img.youtube.com/vi/${encodeURIComponent(v.youtubeId)}/hqdefault.jpg" alt="Watch on YouTube" loading="lazy">
            <div class="play-badge"><svg viewBox="0 0 24 24" fill="#fff"><polygon points="6 3 20 12 6 21"/></svg></div>
            ${v.title ? `<span class="media-label">${escapeHtml(v.title)}</span>` : ''}`;
          videosGrid.appendChild(a);
        });
      })
      .catch(() => { /* keep static fallback */ });
  }

  // --- Blog posts (blog.html) ---
  // Cards are rendered from /data/blog.json (edited in the admin dashboard).
  // Each card opens a full-post reader overlay showing the cover image, body
  // paragraphs and links. All content is escaped via textContent/escapeHtml,
  // and link URLs must pass isSafeHttpsUrl before they are used.
  const blogPosts = document.getElementById('blogPosts');
  const postReader = document.getElementById('postReader');
  const postReaderContent = document.getElementById('postReaderContent');

  function hasReadablePost(p) {
    return Boolean(p && p.title) && (
      (typeof p.url === 'string' && p.url.trim()) ||
      (Array.isArray(p.body) && p.body.some(b => typeof b === 'string' && b.trim()))
    );
  }

  function closePostReader() {
    if (!postReader) return;
    postReader.hidden = true;
    document.body.style.overflow = '';
  }

  function openPostReader(p) {
    if (!postReader || !postReaderContent) return;
    postReaderContent.innerHTML = '';

    if (p.image && typeof p.image === 'string' && p.image.trim()) {
      const hero = document.createElement('img');
      hero.className = 'post-reader-hero';
      hero.src = p.image;
      hero.alt = p.title || 'Off Pitch Africa';
      postReaderContent.appendChild(hero);
    }

    const meta = document.createElement('div');
    meta.className = 'post-reader-meta';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'OFFPITCH AFRICA PLAYBOOK';
    meta.appendChild(eyebrow);
    if (p.date && String(p.date).trim()) {
      const date = document.createElement('span');
      date.className = 'post-reader-date';
      date.textContent = p.date;
      meta.appendChild(date);
    }
    postReaderContent.appendChild(meta);

    const title = document.createElement('h2');
    title.className = 'post-reader-title';
    title.textContent = p.title;
    postReaderContent.appendChild(title);

    const paragraphs = (Array.isArray(p.body) ? p.body : []).filter(b => typeof b === 'string' && b.trim());
    if (paragraphs.length) {
      const body = document.createElement('div');
      body.className = 'post-reader-body';
      paragraphs.forEach(text => {
        const el = document.createElement('p');
        el.textContent = text;
        body.appendChild(el);
      });
      postReaderContent.appendChild(body);
    }

    const links = [];
    if (typeof p.url === 'string' && p.url.trim()) {
      links.push({ label: 'Read the full post on Substack', url: p.url });
    }
    if (Array.isArray(p.links)) {
      p.links.forEach(l => {
        if (l && l.label && l.url && String(l.label).trim() && String(l.url).trim()) {
          links.push({ label: l.label, url: l.url });
        }
      });
    }
    const safeLinks = links.filter(l => isSafeHttpsUrl(l.url));
    if (safeLinks.length) {
      const linksWrap = document.createElement('div');
      linksWrap.className = 'post-reader-links';
      safeLinks.forEach(l => {
        const a = document.createElement('a');
        a.href = l.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.className = 'btn btn-ghost';
        a.textContent = l.label + ' →';
        linksWrap.appendChild(a);
      });
      postReaderContent.appendChild(linksWrap);
    }

    postReader.hidden = false;
    document.body.style.overflow = 'hidden';
    const scroll = postReader.querySelector('.post-reader-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  if (postReader) {
    const closeBtn = postReader.querySelector('.post-reader-close');
    const backdrop = postReader.querySelector('.post-reader-backdrop');
    if (closeBtn) closeBtn.addEventListener('click', closePostReader);
    if (backdrop) backdrop.addEventListener('click', closePostReader);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !postReader.hidden) closePostReader();
    });
  }

  if (blogPosts) {
    fetch('/data/blog.json')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const posts = Array.isArray(data) ? data.filter(hasReadablePost) : [];
        if (posts.length === 0) return; // no posts yet — Substack card below covers it
        blogPosts.innerHTML = '';
        blogPosts.style.display = '';
        posts.forEach(p => {
          const card = document.createElement('button');
          card.type = 'button';
          card.className = 'article-card';
          const img = p.image ? escapeHtml(p.image) : 'assets/img/logo.webp';
          const tagText = p.date && String(p.date).trim() ? p.date : 'Blog';
          card.innerHTML = `
            <div class="article-img">
              <img src="${img}" alt="${escapeHtml(p.title)}" loading="lazy">
              <span class="article-tag">${escapeHtml(tagText)}</span>
            </div>
            <div class="article-body">
              <h3>${escapeHtml(p.title)}</h3>
              ${p.excerpt ? `<p>${escapeHtml(p.excerpt)}</p>` : ''}
              <span class="article-link">READ POST →</span>
            </div>`;
          card.addEventListener('click', () => openPostReader(p));
          blogPosts.appendChild(card);
        });
      })
      .catch(() => { /* keep Substack card as the only content */ });
  }

  /* ---------- Live social feed (hero slideshow + featured cards) ---------- */
  const heroLayers = document.getElementById('heroLayers');
  const featuredGrid = document.getElementById('featuredCoverageGrid');

  // SECURITY: defense-in-depth. The /api/social-feed endpoint already
  // validates these are https:// URLs server-side, but we never trust data
  // from a network response blindly before writing it into the DOM — a
  // second check here costs nothing and guards against any future change to
  // the backend that might forget to sanitize.
  function isSafeHttpsUrl(value) {
    if (typeof value !== 'string') return false;
    try {
      const u = new URL(value, window.location.href);
      return u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // PERFORMANCE: this fetch isn't needed for the initial paint — the page
  // already shows real static fallback content immediately. Deferring it
  // until after the window 'load' event keeps it from competing with
  // critical resources (fonts, CSS, hero image) for bandwidth/connections
  // during the page's most important loading window.
  function fetchSocialFeed() {
    if (!heroLayers && !featuredGrid) return;
    fetch('/api/social-feed')
      .then(res => res.ok ? res.json() : Promise.reject(new Error('bad response')))
      .then(data => {
        const images = Array.isArray(data.images)
          ? data.images.filter(i => i && isSafeHttpsUrl(i.src) && (!i.link || isSafeHttpsUrl(i.link)))
          : [];
        if (!images.length) return; // keep static fallbacks, do nothing further

        // --- Hero slideshow ---
        if (heroLayers) {
          images.forEach((img, i) => {
            const div = document.createElement('div');
            div.className = 'hero-slide' + (i === 0 ? ' active' : '');
            div.style.backgroundImage = `url('${img.src}')`;
            div.setAttribute('role', 'img');
            div.setAttribute('aria-label', img.alt || 'Off Pitch Africa');
            heroLayers.appendChild(div);
          });

          if (images.length > 1) {
            let current = 0;
            setInterval(() => {
              const slides = heroLayers.querySelectorAll('.hero-slide');
              slides[current].classList.remove('active');
              current = (current + 1) % slides.length;
              slides[current].classList.add('active');
            }, 6000);
          }
        }

        // --- Featured Coverage cards: swap in real recent posts ---
        if (featuredGrid && images.length >= 3) {
          const platformLabel = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube' };
          const platformLink = {
            instagram: 'VIEW ON INSTAGRAM →',
            facebook: 'VIEW ON FACEBOOK →',
            youtube: 'WATCH ON YOUTUBE →'
          };

          for (let i = 0; i < 3; i++) {
            const card = document.getElementById('featCard' + i);
            const post = images[i];
            if (!card || !post) continue;

            const img = card.querySelector('img');
            const tag = card.querySelector('.story-tag');
            const h3 = card.querySelector('h3');
            const p = card.querySelector('p');
            const link = card.querySelector('.story-link');

            if (img) { img.src = post.src; img.alt = post.alt || 'Off Pitch Africa'; }
            if (tag) tag.textContent = platformLabel[post.source] || 'Off Pitch Africa';
            if (link) link.textContent = platformLink[post.source] || 'VIEW POST →';
            if (post.link) card.href = post.link;

            // Real caption becomes the card's text. If it's short, show it as
            // the heading; if longer, use the first sentence as heading and
            // the rest as the description — all real, nothing invented.
            const caption = (post.alt || '').trim();
            if (caption) {
              const sentenceEnd = caption.search(/[.!?\n]/);
              if (sentenceEnd > 0 && sentenceEnd < caption.length - 1) {
                if (h3) h3.textContent = caption.slice(0, sentenceEnd + 1).trim();
                if (p) p.textContent = caption.slice(sentenceEnd + 1).trim().slice(0, 140);
              } else {
                if (h3) h3.textContent = caption.slice(0, 90);
                if (p) p.textContent = '';
              }
            }
          }
        }
      })
      .catch(() => {
        // Social feed not configured yet or failed — static fallback content
        // (real facts from the company profile) stays as-is. No action needed.
      });
  }

  if (heroLayers || featuredGrid) {
    if (document.readyState === 'complete') {
      setTimeout(fetchSocialFeed, 0);
    } else {
      window.addEventListener('load', () => setTimeout(fetchSocialFeed, 200));
    }
  }

  /* ---------- Chat assistant ---------- */
  const chatToggle = document.getElementById('chatToggle');
  const chatPanel = document.getElementById('chatPanel');
  const chatBody = document.getElementById('chatBody');
  const chatInput = document.getElementById('chatInput');
  const chatSend = document.getElementById('chatSend');
  if (!chatToggle) return;

  let chatHistory = [];
  let chatOpened = false;

  chatToggle.addEventListener('click', () => {
    chatOpened = !chatOpened;
    chatToggle.classList.toggle('open', chatOpened);
    chatPanel.classList.toggle('open', chatOpened);
    chatToggle.setAttribute('aria-expanded', String(chatOpened));
    if (chatOpened) chatInput.focus();
  });

  function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = 'chat-msg ' + (role === 'user' ? 'user' : 'bot');
    div.textContent = text;
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
    return div;
  }

  const MAX_CHAT_MESSAGE_LENGTH = 1000; // mirrors the server-side limit in api/chat.js

  async function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;
    if (text.length > MAX_CHAT_MESSAGE_LENGTH) {
      addMessage(`That message is a bit long — please keep it under ${MAX_CHAT_MESSAGE_LENGTH} characters.`, 'bot');
      return;
    }
    addMessage(text, 'user');
    chatHistory.push({ role: 'user', content: text });
    chatInput.value = '';
    chatSend.disabled = true;

    const typingEl = addMessage('Typing…', 'bot');
    typingEl.classList.add('typing');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: chatHistory.slice(0, -1) })
      });

      if (res.status === 429) {
        typingEl.remove();
        addMessage("We're getting a lot of messages right now — please wait a moment and try again.", 'bot');
        return;
      }
      if (!res.ok) throw new Error('bad response');

      const data = await res.json();
      typingEl.remove();
      addMessage(data.reply, 'bot');
      chatHistory.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      typingEl.remove();
      addMessage("I'm not connected yet — this chat needs the backend function deployed (see README.md). Meanwhile, reach us at offpitchafrica@gmail.com or +254 704 10 7373.", 'bot');
    } finally {
      chatSend.disabled = false;
    }
  }

  chatSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChat();
  });
});
