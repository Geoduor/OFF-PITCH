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
      { key: 'alt', label: 'Description (alt text)', type: 'text' },
      { key: 'category', label: 'Category', type: 'select', options: ['hockey', 'community', 'celebration'] }
    ]
  },
  blog: {
    label: 'Blog',
    fields: [
      { key: 'title', label: 'Post Title', type: 'text', required: true },
      { key: 'url', label: 'Post URL (Substack link)', type: 'url', required: true },
      { key: 'excerpt', label: 'Short excerpt', type: 'textarea' },
      { key: 'image', label: 'Cover Image (optional)', type: 'image' }
    ]
  },
  videos: {
    label: 'Videos',
    fields: [
      { key: 'youtubeId', label: 'YouTube Video ID (the part after "v=" in the URL)', type: 'text', required: true }
    ]
  }
};

let currentType = 'events';
let items = [];

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const passwordInput = document.getElementById('passwordInput');
const logoutBtn = document.getElementById('logoutBtn');
const tabs = document.querySelectorAll('.admin-tab');
const panelTitle = document.getElementById('panelTitle');
const itemsList = document.getElementById('itemsList');
const addItemBtn = document.getElementById('addItemBtn');
const saveBtn = document.getElementById('saveBtn');
const statusMsg = document.getElementById('statusMsg');

function showStatus(text, isError) {
  statusMsg.textContent = text;
  statusMsg.classList.toggle('error', Boolean(isError));
}

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
      loadType(currentType);
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
      loadType(currentType);
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

/* ---------------- Tabs ---------------- */
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentType = tab.dataset.type;
    panelTitle.textContent = SCHEMAS[currentType].label;
    loadType(currentType);
  });
});

/* ---------------- Load / Render ---------------- */
async function loadType(type) {
  showStatus('Loading…');
  itemsList.innerHTML = '';
  try {
    const res = await fetch(`/api/admin?action=get&type=${encodeURIComponent(type)}`, { credentials: 'same-origin' });
    if (res.status === 401) { checkSession(); return; }
    const data = await res.json();
    items = Array.isArray(data.content) ? data.content : [];
    renderItems();
    showStatus('');
  } catch {
    showStatus('Could not load content. Please refresh and try again.', true);
  }
}

function renderItems() {
  itemsList.innerHTML = '';
  const schema = SCHEMAS[currentType];
  items.forEach((item, index) => {
    itemsList.appendChild(buildItemCard(schema, item, index));
  });
}

function buildItemCard(schema, item, index) {
  const card = document.createElement('div');
  card.className = 'admin-item';

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
    renderItems();
  });
  header.appendChild(label);
  header.appendChild(removeBtn);
  card.appendChild(header);

  const fieldsWrap = document.createElement('div');
  fieldsWrap.className = 'admin-fields';

  schema.fields.forEach(field => {
    fieldsWrap.appendChild(buildField(field, item, index));
  });

  card.appendChild(fieldsWrap);
  return card;
}

function buildField(field, item, index) {
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
    return wrap;
  }

  if (field.type === 'textarea') {
    const ta = document.createElement('textarea');
    ta.value = item[field.key] || '';
    ta.addEventListener('input', () => { item[field.key] = ta.value; });
    wrap.appendChild(ta);
    return wrap;
  }

  const input = document.createElement('input');
  input.type = field.type === 'url' ? 'url' : 'text';
  input.value = item[field.key] || '';
  input.addEventListener('input', () => { item[field.key] = input.value; });
  wrap.appendChild(input);
  return wrap;
}

/* ---------------- Add item ---------------- */
addItemBtn.addEventListener('click', () => {
  const schema = SCHEMAS[currentType];
  const newItem = { id: genId(currentType) };
  schema.fields.forEach(f => {
    if (f.type === 'checkbox') newItem[f.key] = Boolean(f.default);
  });
  items.push(newItem);
  renderItems();
  itemsList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

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

/* ---------------- Save ---------------- */
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

    const res = await fetch('/api/admin', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', type: currentType, content: cleanItems })
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

checkSession();
