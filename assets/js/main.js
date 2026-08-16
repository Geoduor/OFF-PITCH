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

document.addEventListener('DOMContentLoaded', () => {
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
    const cells = document.querySelectorAll('.hexcell');
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const filter = pill.dataset.filter;
        cells.forEach(cell => {
          const show = filter === 'all' || cell.dataset.category === filter;
          cell.style.display = show ? '' : 'none';
        });
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

  // --- Events (index.html) ---
  const eventsList = document.getElementById('eventsList');
  if (eventsList) {
    fetch('/data/events.json')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const events = Array.isArray(data)
          ? data.filter(e => e && e.active !== false && e.title && e.date)
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
          card.innerHTML = `
            <img src="${imgSrc}" alt="${escapeHtml(ev.title)} event poster" loading="lazy">
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
        });
      })
      .catch(() => { /* keep static fallback */ });
  }

  // --- Fixtures & Results (index.html) ---
  const fixturesList = document.getElementById('fixturesList');
  if (fixturesList) {
    const COUNTRY_FLAGS = {
      Kenya: '🇰🇪', Ghana: '🇬🇭', Nigeria: '🇳🇬', 'South Africa': '🇿🇦', Uganda: '🇺🇬'
    };
    const teamLabel = t => `${COUNTRY_FLAGS[t] ? COUNTRY_FLAGS[t] + ' ' : ''}${escapeHtml(t || 'TBD')}`;

    let allFixtures = [];
    let activeFilter = 'All';

    function renderFixtures() {
      fixturesList.innerHTML = '';
      const filtered = activeFilter === 'All' ? allFixtures : allFixtures.filter(f => f.category === activeFilter);
      if (filtered.length === 0) {
        fixturesList.innerHTML = '<p class="admin-image-note">No fixtures to show.</p>';
        return;
      }
      const competitions = [];
      filtered.forEach(fx => {
        const compName = fx.competition || 'Fixtures';
        let comp = competitions.find(c => c.name === compName);
        if (!comp) { comp = { name: compName, days: [] }; competitions.push(comp); }
        let day = comp.days.find(d => d.date === fx.date);
        if (!day) { day = { date: fx.date, rows: [] }; comp.days.push(day); }
        day.rows.push(fx);
      });

      competitions.forEach(comp => {
        const compWrap = document.createElement('div');
        compWrap.className = 'fixtures-competition';
        const h3 = document.createElement('h3');
        h3.className = 'fixtures-competition-title';
        h3.textContent = comp.name;
        compWrap.appendChild(h3);

        comp.days.forEach(day => {
          const dayWrap = document.createElement('div');
          dayWrap.className = 'fixtures-day';
          const h4 = document.createElement('h4');
          h4.className = 'fixtures-day-title';
          h4.textContent = day.date;
          dayWrap.appendChild(h4);

          day.rows.forEach(fx => {
            const row = document.createElement('div');
            row.className = 'fixture-row';
            row.dataset.category = fx.category || '';

            const hasScore = fx.status !== 'upcoming' && (fx.score1 !== '' || fx.score2 !== '');
            const scoreOrTime = fx.status === 'upcoming' || !hasScore
              ? `<span class="fx-time">${escapeHtml(fx.time || '')}</span>`
              : `<span class="fx-score">${escapeHtml(fx.score1)} – ${escapeHtml(fx.score2)}</span>`;
            const liveBadge = fx.status === 'live' ? '<span class="fx-live-badge">LIVE</span>' : '';

            row.innerHTML = `
              ${scoreOrTime}
              <span class="fx-teams">${teamLabel(fx.team1)} <em>vs</em> ${teamLabel(fx.team2)}</span>
              <span class="fx-tag">${escapeHtml(fx.category || '')} · ${escapeHtml(fx.stage || '')}${fx.venue ? ' · ' + escapeHtml(fx.venue) : ''}</span>
              ${liveBadge}`;
            dayWrap.appendChild(row);
          });
          compWrap.appendChild(dayWrap);
        });
        fixturesList.appendChild(compWrap);
      });
    }

    const filterBtns = document.querySelectorAll('#fixturesFilter .fixtures-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderFixtures();
      });
    });

    fetch('/data/fixtures.json')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        allFixtures = Array.isArray(data) ? data.filter(f => f && f.team1 && f.team2 && f.date) : [];
        if (allFixtures.length === 0) return; // keep static fallback
        renderFixtures();
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
          const cell = document.createElement('div');
          cell.className = 'hexcell' + (i % 2 === 1 ? ' offset' : '');
          cell.dataset.category = p.category || 'community';
          const img = document.createElement('img');
          img.src = p.src;
          img.alt = p.alt || 'Off Pitch Africa';
          cell.appendChild(img);
          hexGrid.appendChild(cell);
        });
        // Re-bind the filter buttons to the freshly rendered cells.
        const filterPills = document.querySelectorAll('.filter-pill');
        const cells = hexGrid.querySelectorAll('.hexcell');
        filterPills.forEach(pill => {
          const active = pill.classList.contains('active');
          const filter = pill.dataset.filter;
          cells.forEach(cell => {
            const show = filter === 'all' || cell.dataset.category === filter;
            if (active) cell.style.display = show ? '' : 'none';
          });
        });
      })
      .catch(() => { /* keep static fallback */ });
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
            <div class="play-badge"><svg viewBox="0 0 24 24" fill="#fff"><polygon points="6 3 20 12 6 21"/></svg></div>`;
          videosGrid.appendChild(a);
        });
      })
      .catch(() => { /* keep static fallback */ });
  }

  // --- Blog posts (blog.html) ---
  const blogPosts = document.getElementById('blogPosts');
  if (blogPosts) {
    fetch('/data/blog.json')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const posts = Array.isArray(data) ? data.filter(p => p && p.title && p.url) : [];
        if (posts.length === 0) return; // no posts yet — Substack card below covers it
        blogPosts.innerHTML = '';
        blogPosts.style.display = '';
        posts.forEach(p => {
          const a = document.createElement('a');
          a.href = p.url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.className = 'story-card';
          const img = p.image ? escapeHtml(p.image) : 'assets/img/logo.webp';
          a.innerHTML = `
            <img src="${img}" alt="${escapeHtml(p.title)}">
            <span class="story-tag">Blog</span>
            <div class="body">
              <h3>${escapeHtml(p.title)}</h3>
              ${p.excerpt ? `<p>${escapeHtml(p.excerpt)}</p>` : ''}
              <span class="story-link">READ POST →</span>
            </div>`;
          blogPosts.appendChild(a);
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
