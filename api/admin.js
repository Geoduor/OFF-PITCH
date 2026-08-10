// Off Pitch Africa — admin dashboard client logic.
// Talks only to /api/admin (same-origin). No frameworks, no build step —
// consistent with the rest of this project.

const SCHEMAS = {
  events: {
    label: 'Events',
    fields: [
      { key: 'title', label: 'Event Title', type: 'text', required: true },
      { key: 'theme', label: 'Theme / Subtitle', type: 'text' },
      { key: 'date', label: 'Date (e.g. Saturday, 29th August 2026)', type: 'text', required: true },
      { key: 'time', label: 'Time (e.g. 2:00 PM – 5:00 PM)', type: 'text' },
      { key: 'venue', label: 'Venue', type: 'text' },
      { key: 'image', label: 'Poster Image', type: 'image' },
      { key: 'registerLink', label: 'Registration Link (optional — overrides Call/Email buttons)', type: 'url' },
      { key: 'phone', label: 'Contact Phone', type: 'text' },
      { key: 'email', label: 'Contact Email', type: 'text' },
      { key: 'active', label: 'Show on site', type: 'checkbox', default: true }
    ]
  },
  gallery: {
    label: 'Gallery',
    fields: [
      { key: 'src', label: 'Photo', type: 'image', required: true },
      { key: 'alt', label: 'Description (alt text)', type: 'text', aiAssist: 'altText' },
      { key: 'category', label: 'Category', type: 'select', options: ['hockey', 'community', 'celebration'], aiAssist: 'category' }
    ]
  },
  blog: {
    label: 'Blog',
    fields: [
      { key: 'title', label: 'Post Title', type: 'text', required: true },
      { key: 'url', label: 'Post URL (Substack link)', type: 'url', required: true },
      { key: 'excerpt', label: 'Short excerpt', type: 'textarea', aiAssist: 'excerpt' },
      { key: 'image', label: 'Cover Image (optional)', type: 'image' }
    ]
  },
  videos: {
    label: 'Videos',
    fields: [
      { key: 'youtubeId', label: 'YouTube Video ID (the part after "v=" in the URL)', type: 'text', required: true }
    ]
  },
  fixtures: {
    label: 'Fixtures & Results',
    fields: [
      { key: 'competition', label: 'Competition (e.g. Hockey5s Youth Africa Cup 2026)', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: ['Men', 'Women'] },
      { key: 'stage', label: 'Stage (e.g. Group Stage, Final, Bronze Medal Match)', type: 'text' },
      { key: 'date', label: 'Date (e.g. Thu, 6 Aug 2026)', type: 'text', required: true },
      { key: 'time', label: 'Kickoff Time (e.g. 10:00 AM)', type: 'text' },
      { key: 'team1', label: 'Team 1', type: 'text', required: true },
      { key: 'team2', label: 'Team 2', type: 'text', required: true },
      { key: 'score1', label: 'Team 1 Score (leave blank until played)', type: 'text' },
      { key: 'score2', label: 'Team 2 Score (leave blank until played)', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['upcoming', 'live', 'final'] }
    ]
  },
  live: {
    label: 'Live',
    singleton: true,
    fields: [
      { key: 'active', label: 'Currently live on Facebook/Instagram/TikTok', type: 'checkbox' },
      { key: 'platform', label: 'Platform', type: 'select', options: ['Facebook', 'Instagram', 'TikTok', 'Other'] },
      { key: 'url', label: 'Link to the live post/stream', type: 'url' },
      { key: 'label', label: 'Message shown on the banner (optional)', type: 'text' }
    ]
  }
};

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const passwordInput = document.getElementById('passwordInput');
const logoutBtn = document.getElementById('logoutBtn');

function genId(type) {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ---------------- Auth ---------------- */
async function checkSession() {
  try {
    const res = await fetch('/api/admin?action=check', { credentials: 'same-origin' });
    const data = await res.json();
    if (data.loggedIn) {
      loginScreen.hidden = true;
      dashboard.hidden = false;
      initAllPanels();
    } else {
      loginScreen.hidden = false;
      dashboard.hidden = true;
    }
  } catch {
    loginScreen.hidden = false;
    dashboard.hidden = true;
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const res = await fetch('/api/admin', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', password: passwordInput.value })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      passwordInput.value = '';
      loginScreen.hidden = true;
      dashboard.hidden = false;
      initAllPanels();
    } else {
      loginError.textContent = data.error || 'Incorrect password.';
    }
  } catch {
    loginError.textContent = 'Network error. Please try again.';
  } finally {
    submitBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await fetch('/api/admin', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' })
    });
  } catch { /* ignore */ }
  dashboard.hidden = true;
  loginScreen.hidden = false;
});

/* ---------------- Panels ----------------
   All 5 panels (Events / Gallery / Blog / Videos / Live) are visible on
   the page at once — no tab-switching. Each panel keeps its own items
   array and its own DOM references via closures, so editing one panel
   never touches another's state. */
let panelsInitialized = false;

function initAllPanels() {
  if (panelsInitialized) return; // avoid double-binding on repeat logins in the same page load
  panelsInitialized = true;
  Object.keys(SCHEMAS).forEach(type => initPanel(type));
}

function initPanel(type) {
  const schema = SCHEMAS[type];
  const section = document.getElementById(`panel-${type}`);
  if (!section) return;

  const itemsList = section.querySelector('.admin-items');
  const statusMsg = section.querySelector('.admin-status');
  const addBtn = section.querySelector('.admin-add-btn');
  const saveBtn = section.querySelector('.admin-save-btn');

  let items = [];

  function showStatus(text, isError) {
    statusMsg.textContent = text;
    statusMsg.classList.toggle('error', Boolean(isError));
  }

  function renderItems() {
    itemsList.innerHTML = '';
    if (schema.singleton) {
      if (type === 'live') {
        const note = document.createElement('p');
        note.className = 'admin-image-note';
        note.style.marginBottom = '16px';
        note.textContent = 'This only controls Facebook/Instagram/TikTok. YouTube Live is detected automatically — no need to touch anything here when going live on YouTube.';
        itemsList.appendChild(note);
      }
      itemsList.appendChild(buildItemCard(schema, items[0] || {}, 0, true, items, renderItems));
      return;
    }
    items.forEach((item, index) => {
      itemsList.appendChild(buildItemCard(schema, item, index, false, items, renderItems));
    });
  }

  async function load() {
    showStatus('Loading…');
    try {
      const res = await fetch(`/api/admin?action=get&type=${encodeURIComponent(type)}`, { credentials: 'same-origin' });
      if (res.status === 401) { checkSession(); return; }
      const data = await res.json();
      if (schema.singleton) {
        items = [data.content && typeof data.content === 'object' ? data.content : {}];
      } else {
        items = Array.isArray(data.content) ? data.content : [];
      }
      renderItems();
      showStatus('');
    } catch {
      showStatus('Could not load content. Please refresh and try again.', true);
    }
  }

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const newItem = { id: genId(type) };
      schema.fields.forEach(f => {
        if (f.type === 'checkbox') newItem[f.key] = Boolean(f.default);
      });
      items.push(newItem);
      renderItems();
      itemsList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    showStatus('Saving…');
    try {
      // 1. Upload any pending images first, replacing the field with the real path.
      for (const item of items) {
        if (item._pendingUpload) {
          for (const key of Object.keys(item._pendingUpload)) {
            const { base64, filename } = item._pendingUpload[key];
            const res = await fetch('/api/admin', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'uploadImage', filename, base64 })
            });
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Image upload failed.');
            item[key] = data.path;
          }
          delete item._pendingUpload;
          delete item._pendingPreview;
        }
      }

      // 2. Strip any remaining internal-only fields before saving.
      const cleanItems = items.map(({ _pendingUpload, _pendingPreview, ...rest }) => rest);
      const payload = schema.singleton ? (cleanItems[0] || {}) : cleanItems;

      const res = await fetch('/api/admin', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', type, content: payload })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Save failed.');
      showStatus('Saved — your live site will update in about 10–20 seconds as it redeploys.');
    } catch (err) {
      showStatus(err.message || 'Something went wrong. Please try again.', true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  load();
}

function buildItemCard(schema, item, index, hideHeader, items, rerender) {
  const card = document.createElement('div');
  card.className = 'admin-item';

  if (!hideHeader) {
    const header = document.createElement('div');
    header.className = 'admin-item-header';
    const label = document.createElement('span');
    label.textContent = `${schema.label.slice(0, -1) || schema.label} ${index + 1}`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'admin-item-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      if (!confirm('Remove this item? This takes effect once you click Save Changes.')) return;
      items.splice(index, 1);
      rerender();
    });
    header.appendChild(label);
    header.appendChild(removeBtn);
    card.appendChild(header);
  }

  const fieldsWrap = document.createElement('div');
  fieldsWrap.className = 'admin-fields';

  schema.fields.forEach(field => {
    fieldsWrap.appendChild(buildField(field, item));
  });

  card.appendChild(fieldsWrap);
  return card;
}

function buildField(field, item) {
  const wrap = document.createElement('div');
  wrap.className = 'admin-field' + (field.type === 'textarea' || field.type === 'image' ? ' full' : '');

  if (field.type === 'checkbox') {
    wrap.classList.add('admin-field-checkbox');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = item[field.key] !== undefined ? Boolean(item[field.key]) : Boolean(field.default);
    item[field.key] = cb.checked;
    cb.addEventListener('change', () => { item[field.key] = cb.checked; });
    const lbl = document.createElement('label');
    lbl.textContent = field.label;
    wrap.appendChild(cb);
    wrap.appendChild(lbl);
    return wrap;
  }

  const lbl = document.createElement('label');
  lbl.textContent = field.label;
  wrap.appendChild(lbl);

  if (field.type === 'image') {
    wrap.classList.add('admin-image-field');
    const preview = document.createElement('div');
    preview.className = 'admin-image-preview';
    const previewImg = document.createElement('img');
    const currentSrc = item._pendingPreview && item._pendingPreview[field.key]
      ? item._pendingPreview[field.key]
      : (item[field.key] ? item[field.key] : '');
    if (currentSrc) previewImg.src = currentSrc;
    previewImg.alt = '';
    preview.appendChild(previewImg);

    const controls = document.createElement('div');
    controls.className = 'admin-image-controls';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/webp';
    const note = document.createElement('div');
    note.className = 'admin-image-note';
    note.textContent = 'Images are resized and compressed automatically before upload.';

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      note.textContent = 'Compressing…';
      try {
        const { base64, dataUrl, filename } = await compressImage(file);
        if (!item._pendingUpload) item._pendingUpload = {};
        if (!item._pendingPreview) item._pendingPreview = {};
        item._pendingUpload[field.key] = { base64, filename };
        item._pendingPreview[field.key] = dataUrl;
        previewImg.src = dataUrl;
        note.textContent = 'Ready — will upload when you click Save Changes.';
      } catch {
        note.textContent = 'Could not process that image. Try a different file.';
      }
    });

    controls.appendChild(fileInput);
    controls.appendChild(note);
    wrap.appendChild(preview);
    wrap.appendChild(controls);
    return wrap;
  }

  if (field.type === 'select') {
    const select = document.createElement('select');
    (field.options || []).forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      if (item[field.key] === opt) o.selected = true;
      select.appendChild(o);
    });
    if (!item[field.key] && field.options && field.options.length) item[field.key] = field.options[0];
    select.addEventListener('change', () => { item[field.key] = select.value; });
    wrap.appendChild(select);
    if (field.aiAssist) wrap.appendChild(buildAiAssistButton(field, item, () => select.value = item[field.key]));
    return wrap;
  }

  if (field.type === 'textarea') {
    const ta = document.createElement('textarea');
    ta.value = item[field.key] || '';
    ta.addEventListener('input', () => { item[field.key] = ta.value; });
    wrap.appendChild(ta);
    if (field.aiAssist) wrap.appendChild(buildAiAssistButton(field, item, () => ta.value = item[field.key]));
    return wrap;
  }

  const input = document.createElement('input');
  input.type = field.type === 'url' ? 'url' : 'text';
  input.value = item[field.key] || '';
  input.addEventListener('input', () => { item[field.key] = input.value; });
  wrap.appendChild(input);
  if (field.aiAssist) wrap.appendChild(buildAiAssistButton(field, item, () => input.value = item[field.key]));
  return wrap;
}

/* ---------------- AI content-assist ----------------
   Every suggestion only fills the field in memory (item[field.key]) and
   the visible control — nothing is saved until the section's own Save
   Changes button is clicked, same as manual typing. */
function buildAiAssistButton(field, item, applyToControl) {
  const row = document.createElement('div');
  row.className = 'admin-ai-row';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'admin-ai-btn';
  btn.textContent = '✨ Suggest';
  const note = document.createElement('span');
  note.className = 'admin-ai-note';
  row.appendChild(btn);
  row.appendChild(note);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    note.textContent = 'Thinking…';
    try {
      let body;
      if (field.aiAssist === 'excerpt') {
        if (!item.title) throw new Error('Add a post title first.');
        body = { action: 'excerpt', title: item.title };
      } else {
        // altText/category are only used on the Gallery panel's 'src'
        // photo field in this build — reference it directly rather than
        // guessing, since a new unsaved item won't have any image key yet.
        const imageFieldKey = 'src';
        const pending = item._pendingUpload && item._pendingUpload[imageFieldKey];
        if (pending) {
          body = { action: field.aiAssist, imageBase64: pending.base64, imageMediaType: 'image/jpeg' };
        } else if (item[imageFieldKey]) {
          body = { action: field.aiAssist, imagePath: item[imageFieldKey] };
        } else {
          throw new Error('Add a photo first.');
        }
      }
      const res = await fetch('/api/ai-assist', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not get a suggestion.');
      item[field.key] = data.suggestion;
      applyToControl();
      note.textContent = 'Suggested — review before saving.';
    } catch (err) {
      note.textContent = err.message || 'Something went wrong.';
    } finally {
      btn.disabled = false;
    }
  });

  return row;
}

/* ---------------- Image compression (client-side, no dependencies) ---------------- */
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const base64 = dataUrl.split(',')[1];
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40) || 'image';
      resolve({ base64, dataUrl, filename: `${safeBase}.jpg` });
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not load image')); };
    img.src = objectUrl;
  });
}

checkSession();
