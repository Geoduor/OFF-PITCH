// Off Pitch Africa — shared site behavior (nav, chat widget, contact form)

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Mobile nav toggle ---------- */
  const burger = document.getElementById('navBurger');
  const navlinks = document.getElementById('navLinks');
  if (burger && navlinks) {
    burger.addEventListener('click', () => {
      const open = navlinks.classList.toggle('open');
      burger.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', String(open));
    });
    navlinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navlinks.classList.remove('open');
        burger.classList.remove('open');
      });
    });
  }

  /* ---------- Contact form (Formspree) ---------- */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('formStatus');
      const btn = contactForm.querySelector('button[type="submit"]');
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

  /* ---------- Hero slideshow (live social feed) ---------- */
  const heroLayers = document.getElementById('heroLayers');
  if (heroLayers) {
    fetch('/api/social-feed')
      .then(res => res.ok ? res.json() : Promise.reject(new Error('bad response')))
      .then(data => {
        const images = Array.isArray(data.images) ? data.images.filter(i => i && i.src) : [];
        if (!images.length) return; // keep static fallback photo, do nothing further

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
      })
      .catch(() => {
        // Social feed not configured yet or failed — the static hero photo
        // underneath (.hero-bg-static) stays visible. No action needed.
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

  async function sendChat() {
    const text = chatInput.value.trim();
    if (!text) return;
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
