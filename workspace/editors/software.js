// ============================================================
// Software editor — list of released open-source / research artefacts.
// Same shape as a thinner Projects: title + year + link + image +
// optional description. Drag-to-reorder. Renders via .lablife-admin-card
// styles because the layout (image-on-top card grid) is identical.
// ============================================================

import {
  githubGetFile,
  githubUpdateFile,
  githubUploadImage,
  decodeGithubContent,
  toast,
  openModal,
  closeModal,
  confirm,
  t,
  applyI18n,
  BASE,
  escapeHtml,
  safeUrl,
  sanitizeFilename,
} from '../admin.js';
import { icon } from '../ui.js';
import { moveBefore } from '../editor-base.js';

let softwareData = null;
let softwareSha = null;
let editingItem = null;
let isDirty = false;
let dragSrc = null;

function markDirty() {
  isDirty = true;
  const btn = document.getElementById('software-publish');
  if (btn) btn.disabled = false;
}
function clearDirty() {
  isDirty = false;
  const btn = document.getElementById('software-publish');
  if (btn) btn.disabled = true;
}

export async function initSoftwareEditor() {
  const section = document.getElementById('section-software');
  section.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title" data-i18n="software_title">Software</div>
        <div class="section-desc" data-i18n="software_desc">Manage published software, demos, and research artefacts</div>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center">
        <button class="btn btn-ghost btn-sm" id="software-refresh">
          ${icon('refresh')}
          <span data-i18n="btn_refresh">Refresh</span>
        </button>
        <button class="btn btn-accent btn-sm" id="software-add">
          ${icon('plus')}
          <span data-i18n="software_add">Add Software</span>
        </button>
      </div>
    </div>
    <div id="software-body">
      <div class="empty-state"><div class="loader-spinner" style="margin:0 auto"></div></div>
    </div>
    <div class="publish-bar">
      <span class="publish-bar-hint" data-i18n="publish_hint">Changes are saved locally until you publish</span>
      <button class="btn btn-accent" id="software-publish" disabled>
        ${icon('publish')}
        <span data-i18n="publish_btn">Publish Changes</span>
      </button>
    </div>`;

  applyI18n();
  document.getElementById('software-refresh').addEventListener('click', loadSoftware);
  document.getElementById('software-publish').addEventListener('click', publishSoftware);
  document.getElementById('software-add').addEventListener('click', () => { editingItem = -1; openItemModal(null); });
  setupItemModal();
  await loadSoftware();
}

async function loadSoftware() {
  try {
    const file = await githubGetFile('_data/software.json');
    softwareSha = file?.sha || null;
    softwareData = file
      ? JSON.parse(decodeGithubContent(file.content))
      : { intro: '', items: [] };
    if (!softwareData.items) softwareData.items = [];
    renderSoftware();
    clearDirty();
  } catch (err) {
    document.getElementById('software-body').innerHTML =
      `<div class="alert alert-warning">Failed to load: ${escapeHtml(err.message)}</div>`;
  }
}

function renderSoftware() {
  const body = document.getElementById('software-body');
  if (!softwareData) return;
  const items = softwareData.items;
  const reorderLabel = escapeHtml(t('drag_to_reorder'));

  let html = `
    <div style="margin-bottom:1.25rem">
      <label style="font-size:0.78rem;font-weight:500;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em" data-i18n="intro_text">Intro Text</label>
      <textarea id="software-intro"
        style="width:100%;margin-top:0.35rem;padding:0.6rem 0.85rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);min-height:60px;resize:vertical;font-family:var(--font);font-size:0.85rem"
        oninput="window._softwareIntroChange(this.value)">${escapeHtml(softwareData.intro) || ''}</textarea>
    </div>`;

  if (!items.length) {
    html += `<div class="empty-state" style="padding:3rem 0;text-align:center;color:var(--text2)">
      <div style="margin:0 auto 1rem;opacity:0.4">${icon('image', { size: 40 })}</div>
      <div style="font-size:0.9rem" data-i18n="software_empty">No software entries yet. Click <strong>Add Software</strong> to get started.</div>
    </div>`;
    body.innerHTML = html;
    return;
  }

  html += `<div class="lablife-admin-grid">`;
  items.forEach((entry, i) => {
    const imgSrc = entry.image
      ? `${BASE}/images/software/${encodeURIComponent(entry.image)}`
      : '';
    const linkLabel = entry.link ? safeHostname(entry.link) : '';
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
          <div class="lablife-admin-card-date">${entry.year ? escapeHtml(String(entry.year)) : ''}${linkLabel ? ` · ${linkLabel}` : ''}</div>
          ${entry.description ? `<div class="lablife-admin-card-desc">${escapeHtml(entry.description)}</div>` : ''}
        </div>
        <div class="lablife-admin-card-actions">
          <button class="btn btn-ghost btn-sm" onclick="window._softwareEdit(${i})" aria-label="Edit">
            ${icon('edit')}
          </button>
          <button class="btn btn-danger btn-sm" onclick="window._softwareDelete(${i})" aria-label="Delete">
            ${icon('delete')}
          </button>
        </div>
      </div>`;
  });
  html += `</div>`;
  body.innerHTML = html;
  setupDragDrop();
}

// ── Globals + drag/drop ─────────────────────────────────
window._softwareIntroChange = (v) => {
  softwareData.intro = v;
  markDirty();
};
window._softwareEdit = (i) => {
  editingItem = i;
  openItemModal(softwareData.items[i]);
};
window._softwareDelete = async (i) => {
  const entry = softwareData.items[i];
  if (!entry) return;
  if (!(await confirm(`Remove "${entry.title}"?`))) return;
  softwareData.items.splice(i, 1);
  markDirty();
  renderSoftware();
};

// Pull the hostname out of a URL string for the card meta line. Falls back
// to '' if the URL is unparseable (which happens for relative-style values
// like "example.com/tool" since new URL() needs a scheme). Tested via the
// Playwright suite — the previous `new URL(link, BASE)` form threw because
// BASE="/site" isn't a valid absolute base URL.
function safeHostname(url) {
  try {
    return escapeHtml(new URL(url).hostname.replace(/^www\./, ''));
  } catch {
    return '';
  }
}

function setupDragDrop() {
  document.querySelectorAll('#software-body .lablife-admin-card[draggable]').forEach(cardEl => {
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
      document.querySelectorAll('#software-body .lablife-admin-card.drag-over').forEach(el => el.classList.remove('drag-over'));
      if (dragSrc !== +cardEl.dataset.i) cardEl.classList.add('drag-over');
    });
    cardEl.addEventListener('dragleave', () => cardEl.classList.remove('drag-over'));
    cardEl.addEventListener('drop', e => {
      e.preventDefault();
      cardEl.classList.remove('drag-over');
      if (dragSrc === null) return;
      const to = +cardEl.dataset.i;
      if (dragSrc === to) return;
      moveBefore(softwareData.items, dragSrc, to);
      dragSrc = null;
      markDirty();
      renderSoftware();
    });
  });
}

// ── Entry modal ─────────────────────────────────────────
function setupItemModal() {
  document.getElementById('software-modal-close').addEventListener('click', () => closeModal('software-modal'));
  document.getElementById('software-modal-cancel').addEventListener('click', () => closeModal('software-modal'));
  document.getElementById('software-modal-save').addEventListener('click', saveItem);

  const area = document.getElementById('software-img-area');
  const input = document.getElementById('software-img-input');
  const preview = document.getElementById('software-img-preview');

  area.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', async (e) => {
    e.preventDefault(); area.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file, area, preview);
  });
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageFile(file, area, preview);
  });
}

async function handleImageFile(file, area, preview) {
  const reader = new FileReader();
  reader.onload = (r) => { preview.src = r.target.result; preview.style.display = 'block'; };
  reader.readAsDataURL(file);
  const safeName = sanitizeFilename(file.name);
  try {
    area.style.opacity = '0.5';
    area.style.pointerEvents = 'none';
    await githubUploadImage('images/software/' + safeName, file);
    area.style.opacity = '1';
    area.style.pointerEvents = '';
    document.getElementById('software-image').value = safeName;
    toast('Image uploaded', 'success');
  } catch (err) {
    area.style.opacity = '1';
    area.style.pointerEvents = '';
    toast('Upload failed: ' + err.message, 'error');
  }
}

function openItemModal(entry) {
  const isNew = !entry;
  document.getElementById('software-modal-title').textContent = isNew
    ? t('software_add_title')
    : t('software_edit_title');
  document.getElementById('software-title').value = entry?.title || '';
  document.getElementById('software-year').value = entry?.year || new Date().getFullYear();
  document.getElementById('software-link').value = entry?.link || '';
  document.getElementById('software-desc').value = entry?.description || '';
  document.getElementById('software-image').value = entry?.image || '';
  document.getElementById('software-image-alt').value = entry?.image_alt || '';

  const preview = document.getElementById('software-img-preview');
  if (entry?.image) {
    preview.src = `${BASE}/images/software/${encodeURIComponent(entry.image)}`;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
    preview.src = '';
  }
  document.getElementById('software-img-input').value = '';
  openModal('software-modal');
}

function saveItem() {
  const yearStr = document.getElementById('software-year').value.trim();
  const year = yearStr ? Number(yearStr) : undefined;
  const entry = {
    title: document.getElementById('software-title').value.trim(),
    year: Number.isFinite(year) ? year : undefined,
    link: document.getElementById('software-link').value.trim() || undefined,
    description: document.getElementById('software-desc').value.trim() || undefined,
    image: document.getElementById('software-image').value.trim() || undefined,
    image_alt: document.getElementById('software-image-alt').value.trim() || undefined,
  };
  // Sanity: scrub javascript:/data: URLs at save time too (defense in depth;
  // the public Liquid template renders them via Jekyll, not safeUrl).
  if (entry.link && !/^https?:\/\//i.test(entry.link)) {
    entry.link = 'https://' + entry.link.replace(/^\/+/, '');
  }
  Object.keys(entry).forEach(k => entry[k] === undefined && delete entry[k]);

  if (editingItem === -1) softwareData.items.push(entry);
  else softwareData.items[editingItem] = entry;
  closeModal('software-modal');
  markDirty();
  renderSoftware();
}

// ── Publish ──────────────────────────────────────────────
async function publishSoftware() {
  if (!isDirty) return;
  const btn = document.getElementById('software-publish');
  const origHTML = btn.innerHTML;
  btn.disabled = true; btn.textContent = t('publishing');
  try {
    const result = await githubUpdateFile(
      '_data/software.json',
      JSON.stringify(softwareData, null, 2),
      'admin: update software list',
      softwareSha
    );
    if (result?.content?.sha) softwareSha = result.content.sha;
    btn.innerHTML = origHTML;
    clearDirty();
    toast('Software published! Site will rebuild in ~1-2 min.', 'success');
  } catch (err) {
    btn.innerHTML = origHTML; btn.disabled = false;
    toast('Publish failed: ' + err.message, 'error');
  }
}
