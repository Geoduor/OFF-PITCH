// Off Pitch Africa — shared site behavior (nav, chat widget, contact form)

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

  if (heroLayers || featuredGrid) {
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
