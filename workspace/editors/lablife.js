import { githubGetFile, githubUpdateFile, githubUploadImage, decodeGithubContent, toast, openModal, closeModal, confirm, t, applyI18n, BASE, escapeHtml, sanitizeFilename } from '../admin.js';
import { icon } from '../ui.js';
import { moveBefore } from '../editor-base.js';

let lablifeData = null;
let lablifeSha = null;
let editingEntry = null;
let isDirty = false;
let dragSrc = null;

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
          ${icon('refresh')}
          <span data-i18n="btn_refresh">Refresh</span>
        </button>
        <button class="btn btn-accent btn-sm" id="lablife-add">
          ${icon('plus')}
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
        ${icon('publish')}
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
    lablifeSha = file?.sha || null;
    lablifeData = file ? JSON.parse(decodeGithubContent(file.content)) : { entries: [] };
    if (!lablifeData.entries) lablifeData.entries = [];
    renderLabLife();
    clearDirty();
  } catch (err) {
    document.getElementById('lablife-body').innerHTML = `<div class="alert alert-warning">Failed to load: ${escapeHtml(err.message)}</div>`;
  }
}

function renderLabLife() {
  const body = document.getElementById('lablife-body');
  if (!lablifeData) return;

  // Use the natural array order so drag-to-reorder is the source of truth.
  // (Used to auto-sort by date desc — that fought against manual reorder.)
  const entries = lablifeData.entries;

  if (!entries.length) {
    body.innerHTML = `<div class="empty-state" style="padding:3rem 0;text-align:center;color:var(--text2)">
      <div style="margin:0 auto 1rem;opacity:0.4">${icon('image', { size: 40 })}</div>
      <div style="font-size:0.9rem">No gallery entries yet. Click <strong>Add Entry</strong> to get started.</div>
    </div>`;
    return;
  }

  const reorderLabel = escapeHtml(t('drag_to_reorder'));
  let html = `<div class="lablife-admin-grid">`;
  entries.forEach((entry, i) => {
    const imgSrc = entry.cover ? `${BASE}/images/lablife/${encodeURIComponent(entry.cover)}` : '';
    html += `
      <div class="lablife-admin-card" draggable="true" data-i="${i}">
        <span class="grip grip--card" title="${reorderLabel}" aria-hidden="true">${icon('grip')}</span>
        <div class="lablife-admin-card-img">
          ${imgSrc
            ? `<img src="${imgSrc}" alt="${escapeHtml(entry.title) || ''}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
            : ''}
          <div class="lablife-admin-card-placeholder" style="${imgSrc ? 'display:none' : ''}">
            ${icon('image', { size: 32 })}
          </div>
        </div>
        <div class="lablife-admin-card-body">
          <div class="lablife-admin-card-title">${escapeHtml(entry.title) || '—'}</div>
          <div class="lablife-admin-card-date">${escapeHtml(entry.date) || ''}</div>
          ${entry.description ? `<div class="lablife-admin-card-desc">${escapeHtml(entry.description)}</div>` : ''}
        </div>
        <div class="lablife-admin-card-actions">
          <button class="btn btn-ghost btn-sm" onclick="window._lablifeEdit(${i})" aria-label="Edit">
            ${icon('edit')}
          </button>
          <button class="btn btn-danger btn-sm" onclick="window._lablifeDelete(${i})" aria-label="Delete">
            ${icon('delete')}
          </button>
        </div>
      </div>`;
  });
  html += `</div>`;
  body.innerHTML = html;
  setupDragDrop();
}

// ── Drag-and-drop for gallery cards ──────────────────────────
function setupDragDrop() {
  document.querySelectorAll('#lablife-body .lablife-admin-card[draggable]').forEach(cardEl => {
    cardEl.addEventListener('dragstart', e => {
      dragSrc = +cardEl.dataset.i;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => cardEl.classList.add('dragging'), 0);
    });
    cardEl.addEventListener('dragend', () => {
      cardEl.classList.remove('dragging');
      dragSrc = null;
    });
    cardEl.addEventListener('dragover', e => {
      if (dragSrc === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('#lablife-body .lablife-admin-card.drag-over').forEach(el => el.classList.remove('drag-over'));
      if (dragSrc !== +cardEl.dataset.i) cardEl.classList.add('drag-over');
    });
    cardEl.addEventListener('dragleave', () => cardEl.classList.remove('drag-over'));
    cardEl.addEventListener('drop', e => {
      e.preventDefault();
      cardEl.classList.remove('drag-over');
      if (dragSrc === null) return;
      const to = +cardEl.dataset.i;
      if (dragSrc === to) return;
      moveBefore(lablifeData.entries, dragSrc, to);
      dragSrc = null;
      markDirty();
      renderLabLife();
    });
  });
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
  const safeName = sanitizeFilename(file.name);
  try {
    area.style.opacity = '0.5';
    area.style.pointerEvents = 'none';
    await githubUploadImage('images/lablife/' + safeName, file);
    area.style.opacity = '1';
    area.style.pointerEvents = '';
    document.getElementById(fieldId).value = safeName;
    toast('Image uploaded', 'success');
  } catch (err) {
    area.style.opacity = '1';
    area.style.pointerEvents = '';
    toast('Upload failed: ' + err.message, 'error');
  }
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
    preview.src = `${BASE}/images/lablife/${encodeURIComponent(entry.cover)}`;
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
    const result = await githubUpdateFile('_data/lablife.json', JSON.stringify(lablifeData, null, 2), 'admin: update lab life gallery', lablifeSha);
    if (result?.content?.sha) lablifeSha = result.content.sha;
    btn.innerHTML = origHTML;
    clearDirty();
    toast('Lab Life published! Site will rebuild in ~1-2 min.', 'success');
  } catch (err) {
    btn.innerHTML = origHTML; btn.disabled = false;
    toast('Publish failed: ' + err.message, 'error');
  }
}
