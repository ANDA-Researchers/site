import { githubGetFile, githubUpdateFile, githubUploadImage, decodeGithubContent, toast, openModal, closeModal, confirm, t, applyI18n, BASE } from '../admin.js';

let lablifeData = null;
let editingEntry = null;
let isDirty = false;

function markDirty() {
  isDirty = true;
  const btn = document.getElementById('lablife-publish');
  if (btn) btn.disabled = false;
}

function clearDirty() {
  isDirty = false;
  const btn = document.getElementById('lablife-publish');
  if (btn) btn.disabled = true;
}

export async function initLabLifeEditor() {
  const section = document.getElementById('section-lablife');
  section.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title" data-i18n="lablife_title">Lab Life</div>
        <div class="section-desc" data-i18n="lablife_desc">Manage gallery events and photos</div>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center">
        <button class="btn btn-ghost btn-sm" id="lablife-refresh">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H5.498a.75.75 0 00-.75.75v3.475a.75.75 0 001.5 0v-1.324l.37.37a7 7 0 0011.722-3.138.75.75 0 00-1.442-.282zM10.47 5.05A7 7 0 003.058 8.26a.75.75 0 101.47.286 5.5 5.5 0 019.187-2.334l.31.31H11.5a.75.75 0 000 1.5h3.475a.75.75 0 00.75-.75V3.807a.75.75 0 00-1.5 0v1.324l-.354-.354A7 7 0 0010.47 5.05z" clip-rule="evenodd"/></svg>
          <span data-i18n="btn_refresh">Refresh</span>
        </button>
        <button class="btn btn-accent btn-sm" id="lablife-add">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
          <span data-i18n="lablife_add">Add Entry</span>
        </button>
      </div>
    </div>
    <div id="lablife-body">
      <div class="empty-state"><div class="loader-spinner" style="margin:0 auto"></div></div>
    </div>
    <div class="publish-bar">
      <span class="publish-bar-hint" data-i18n="publish_hint">Changes are saved locally until you publish</span>
      <button class="btn btn-accent" id="lablife-publish" disabled>
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"/><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/></svg>
        <span data-i18n="publish_btn">Publish Changes</span>
      </button>
    </div>`;

  applyI18n();
  document.getElementById('lablife-refresh').addEventListener('click', loadLabLife);
  document.getElementById('lablife-publish').addEventListener('click', publishLabLife);
  document.getElementById('lablife-add').addEventListener('click', () => { editingEntry = -1; openEntryModal(null); });
  setupEntryModal();
  await loadLabLife();
}

async function loadLabLife() {
  try {
    const file = await githubGetFile('_data/lablife.json');
    lablifeData = file ? JSON.parse(decodeGithubContent(file.content)) : { entries: [] };
    if (!lablifeData.entries) lablifeData.entries = [];
    renderLabLife();
    clearDirty();
  } catch (err) {
    document.getElementById('lablife-body').innerHTML = `<div class="alert alert-warning">Failed to load: ${err.message}</div>`;
  }
}

function renderLabLife() {
  const body = document.getElementById('lablife-body');
  if (!lablifeData) return;

  const entries = [...lablifeData.entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (!entries.length) {
    body.innerHTML = `<div class="empty-state" style="padding:3rem 0;text-align:center;color:var(--text2)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" style="margin:0 auto 1rem;display:block;opacity:0.4"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9l4-4 4 4 4-6 4 4"/><circle cx="8" cy="14" r="2"/></svg>
      <div style="font-size:0.9rem">No gallery entries yet. Click <strong>Add Entry</strong> to get started.</div>
    </div>`;
    return;
  }

  let html = `<div class="lablife-admin-grid">`;
  entries.forEach((entry, i) => {
    const realIdx = lablifeData.entries.indexOf(entry);
    const imgSrc = entry.cover ? `${BASE}/images/lablife/${entry.cover}` : '';
    html += `
      <div class="lablife-admin-card">
        <div class="lablife-admin-card-img">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="${entry.title || ''}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <div class="lablife-admin-card-placeholder" style="${imgSrc ? 'display:none' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9l4-4 4 4 4-6 4 4"/><circle cx="8" cy="14" r="2"/></svg>
          </div>
        </div>
        <div class="lablife-admin-card-body">
          <div class="lablife-admin-card-title">${entry.title || '—'}</div>
          <div class="lablife-admin-card-date">${entry.date || ''}</div>
          ${entry.description ? `<div class="lablife-admin-card-desc">${entry.description}</div>` : ''}
        </div>
        <div class="lablife-admin-card-actions">
          <button class="btn btn-ghost btn-sm" onclick="window._lablifeEdit(${realIdx})">
            <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
          </button>
          <button class="btn btn-danger btn-sm" onclick="window._lablifeDelete(${realIdx})">✕</button>
        </div>
      </div>`;
  });
  html += `</div>`;
  body.innerHTML = html;
}

window._lablifeEdit = (i) => { editingEntry = i; openEntryModal(lablifeData.entries[i]); };
window._lablifeDelete = async (i) => {
  const e = lablifeData.entries[i];
  if (!await confirm(`Remove "${e.title}"?`)) return;
  lablifeData.entries.splice(i, 1);
  markDirty(); renderLabLife();
};

// ── Entry Modal ────────────────────────────────
function setupEntryModal() {
  document.getElementById('lablife-modal-close').addEventListener('click', () => closeModal('lablife-modal'));
  document.getElementById('lablife-modal-cancel').addEventListener('click', () => closeModal('lablife-modal'));
  document.getElementById('lablife-modal-save').addEventListener('click', saveEntry);

  const area = document.getElementById('lablife-img-area');
  const input = document.getElementById('lablife-img-input');
  const preview = document.getElementById('lablife-img-preview');

  area.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', async (e) => {
    e.preventDefault(); area.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file, area, preview, 'lablife-cover');
  });
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file, area, preview, 'lablife-cover');
  });
}

async function handleImageFile(file, area, preview, fieldId) {
  const reader = new FileReader();
  reader.onload = (r) => { preview.src = r.target.result; preview.style.display = 'block'; };
  reader.readAsDataURL(file);
  try {
    area.style.opacity = '0.5';
    await githubUploadImage('images/lablife/' + file.name, file);
    area.style.opacity = '1';
    document.getElementById(fieldId).value = file.name;
    toast('Image uploaded', 'success');
  } catch (err) { area.style.opacity = '1'; toast('Upload failed: ' + err.message, 'error'); }
}

function openEntryModal(entry) {
  const isNew = !entry;
  document.getElementById('lablife-modal-title').textContent = isNew ? t('lablife_add_title') : t('lablife_edit_title');
  document.getElementById('lablife-entry-title').value = entry?.title || '';
  document.getElementById('lablife-entry-date').value = entry?.date || new Date().toISOString().slice(0, 10);
  document.getElementById('lablife-entry-desc').value = entry?.description || '';
  document.getElementById('lablife-cover').value = entry?.cover || '';

  const preview = document.getElementById('lablife-img-preview');
  if (entry?.cover) {
    preview.src = `${BASE}/images/lablife/${entry.cover}`;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
    preview.src = '';
  }
  // Reset file input
  document.getElementById('lablife-img-input').value = '';
  openModal('lablife-modal');
}

function saveEntry() {
  const entry = {
    title: document.getElementById('lablife-entry-title').value.trim(),
    date: document.getElementById('lablife-entry-date').value,
    cover: document.getElementById('lablife-cover').value.trim() || undefined,
    description: document.getElementById('lablife-entry-desc').value.trim() || undefined,
  };
  Object.keys(entry).forEach(k => entry[k] === undefined && delete entry[k]);

  if (editingEntry === -1) {
    lablifeData.entries.unshift(entry);
  } else {
    lablifeData.entries[editingEntry] = entry;
  }
  closeModal('lablife-modal');
  markDirty(); renderLabLife();
}

// ── Publish ────────────────────────────────────
async function publishLabLife() {
  if (!isDirty) return;
  const btn = document.getElementById('lablife-publish');
  const origHTML = btn.innerHTML;
  btn.disabled = true; btn.textContent = t('publishing');
  try {
    await githubUpdateFile('_data/lablife.json', JSON.stringify(lablifeData, null, 2), 'admin: update lab life gallery');
    btn.innerHTML = origHTML;
    clearDirty();
    toast('Lab Life published! Site will rebuild in ~1-2 min.', 'success');
  } catch (err) {
    btn.innerHTML = origHTML; btn.disabled = false;
    toast('Publish failed: ' + err.message, 'error');
  }
}
