// ============================================================
// Team editor — first editor on the new component foundation.
//
// Composed of: sectionHeader / publishBar / card / icon (ui.js),
// attachUpload (upload.js), createEditor controller (editor-base.js).
//
// Globals previously living on window._team* are gone — every button
// emits data-action="…" and the controller delegates to a single click
// handler. Drag-and-drop is editor-specific so stays inline.
// ============================================================

import {
  applyI18n,
  t,
  escapeHtml,
  safeUrl,
  openModal,
  closeModal,
  confirm,
} from '../admin.js';
import {
  sectionHeader,
  publishBar,
  card,
  icon,
  imageSrc,
} from '../ui.js';
import { attachUpload, setUploadPreview } from '../upload.js';
import { createEditor, arrayMove, moveBefore } from '../editor-base.js';

let editingMember = null;
let editingAlumni = null;
let dragSrc = null;
let ctrl = null;
let memberUploadHandle = null;

// ── Boot ─────────────────────────────────────────────────────
export async function initTeamEditor() {
  const section = document.getElementById('section-team');
  section.innerHTML = `
    ${sectionHeader({
      titleKey: 'team_title',
      titleFallback: 'Team Members',
      descKey: 'team_desc',
      descFallback: 'Manage lab members, sections, and alumni',
      actions: `
        <button class="btn btn-ghost btn-sm" id="team-refresh">
          ${icon('refresh')}
          <span data-i18n="btn_refresh">Refresh</span>
        </button>`,
    })}
    <div id="team-body">
      <div class="empty-state"><div class="loader-spinner" style="margin:0 auto"></div></div>
    </div>
    ${publishBar({ btnId: 'team-publish' })}
  `;
  applyI18n();

  ctrl = createEditor({
    sectionId: 'section-team',
    filePath: '_data/team.json',
    defaultData: { sections: [], alumni: [] },
    publishBtnId: 'team-publish',
    refreshBtnId: 'team-refresh',
    commitMsg: 'admin: update team data',
    successMsg: 'Team published! Site will rebuild in ~1-2 min.',
    render: renderTeam,
  });
  ctrl.attachRefreshButton();
  ctrl.attachPublishButton();
  ctrl.bindActions(section, actionHandlers);
  bindContenteditableTitles(section);

  setupMemberModal();
  setupAlumniModal();
  await ctrl.reload({ confirmIfDirty: false });
}

// ── Render ───────────────────────────────────────────────────
function renderTeam(data) {
  const body = document.getElementById('team-body');
  if (!body || !data) return;
  const sectionsHtml = data.sections.map((sec, si) => renderSection(sec, si)).join('');
  const alumniHtml = renderAlumniBlock(data.alumni || []);
  body.innerHTML = `
    ${sectionsHtml}
    ${alumniHtml}
    <button class="btn btn-ghost btn-sm team-add-section" data-action="section-add">
      ${icon('plus')}<span data-i18n="add_section">${escapeHtml(t('add_section'))}</span>
    </button>`;
  applyI18n();
  setupDragDrop();
}

function renderSection(sec, si) {
  const memberCards = (sec.members || []).map((m, mi) => renderMemberCard(m, si, mi)).join('');
  const reorderLabel = escapeHtml(t('drag_to_reorder'));
  return `
    <div class="section-block" data-si="${si}">
      <div class="group-header">
        <span class="grip section-drag-handle" draggable="true" data-si="${si}" title="${reorderLabel}" aria-label="${reorderLabel}">${icon('grip')}</span>
        <div class="group-title" contenteditable="true" data-rename-section="${si}" spellcheck="false">${escapeHtml(sec.title)}</div>
        <div class="group-actions">
          <button class="btn btn-ghost btn-sm" data-action="member-add" data-args="[${si}]">
            ${icon('plus')}<span data-i18n="add_member">${escapeHtml(t('add_member'))}</span>
          </button>
          <button class="btn btn-danger btn-sm" data-action="section-delete" data-args="[${si}]" aria-label="${escapeHtml(t('del_section'))}">
            ${icon('delete')}
          </button>
        </div>
      </div>
      <div class="items-grid" id="team-grid-${si}">${memberCards}</div>
    </div>`;
}

function renderMemberCard(m, si, mi) {
  const actions = `
    <button class="btn btn-ghost btn-sm" data-action="member-edit" data-args="[${si},${mi}]" aria-label="${escapeHtml(t('edit_member'))}">${icon('edit')}</button>
    <button class="btn btn-danger btn-sm" data-action="member-delete" data-args="[${si},${mi}]" aria-label="${escapeHtml(t('btn_remove'))}">${icon('delete')}</button>`;
  return card({
    image: m.image ? { src: imageSrc('images', m.image), alt: m.name || '' } : null,
    title: m.name,
    subtitle: m.role || '',
    variant: 'grid',
    dataset: { si, mi },
    handle: true,
    draggable: true,
    actions,
  });
}

function renderAlumniBlock(alumni) {
  const rows = alumni.map((a, ai) => renderAlumniRow(a, ai)).join('');
  const empty = alumni.length
    ? ''
    : `<div class="alumni-empty" data-i18n="no_alumni">${escapeHtml(t('no_alumni'))}</div>`;
  return `
    <div class="group-header">
      <div class="group-title" data-i18n="alumni_heading">${escapeHtml(t('alumni_heading'))}</div>
      <div class="group-actions">
        <button class="btn btn-ghost btn-sm" data-action="alumni-add">
          ${icon('plus')}<span data-i18n="add_alumni">${escapeHtml(t('add_alumni'))}</span>
        </button>
      </div>
    </div>
    <div class="alumni-list-admin" id="alumni-list">
      ${empty}
      ${rows}
    </div>`;
}

function renderAlumniRow(a, ai) {
  const link = safeUrl(a.link);
  const name = escapeHtml(a.name);
  const reorderLabel = escapeHtml(t('drag_to_reorder'));
  return `
    <div class="alumni-row" draggable="true" data-ai="${ai}">
      <span class="grip grip--row" title="${reorderLabel}" aria-hidden="true">${icon('grip')}</span>
      <div class="alumni-row-name">${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${name}</a>` : name}</div>
      <div class="alumni-row-role">${escapeHtml(a.role) || ''}</div>
      <div class="alumni-row-actions">
        <button class="btn btn-ghost btn-sm" data-action="alumni-edit" data-args="[${ai}]" aria-label="${escapeHtml(t('edit_alumni'))}">${icon('edit')}</button>
        <button class="btn btn-danger btn-sm" data-action="alumni-delete" data-args="[${ai}]" aria-label="${escapeHtml(t('btn_remove'))}">${icon('delete')}</button>
      </div>
    </div>`;
}

// ── Action handlers (replaces window._team*) ─────────────────
const data = () => ctrl.getData();

const actionHandlers = {
  'section-add': () => {
    data().sections.push({ title: 'New Section', members: [] });
    ctrl.markDirty();
    ctrl.rerender();
  },
  'section-delete': async (_e, [si]) => {
    const sec = data().sections[si];
    if (!sec) return;
    const ok = await confirm(`Delete section "${sec.title}" and all its members?`);
    if (!ok) return;
    data().sections.splice(si, 1);
    ctrl.markDirty();
    ctrl.rerender();
  },
  'member-add': (_e, [si]) => {
    editingMember = { si, mi: -1 };
    openMemberModal(null);
  },
  'member-edit': (_e, [si, mi]) => {
    editingMember = { si, mi };
    openMemberModal(data().sections[si].members[mi]);
  },
  'member-delete': async (_e, [si, mi]) => {
    const m = data().sections[si].members[mi];
    if (!m) return;
    const ok = await confirm(`Remove ${m.name}?`);
    if (!ok) return;
    data().sections[si].members.splice(mi, 1);
    ctrl.markDirty();
    ctrl.rerender();
  },
  'alumni-add': () => {
    editingAlumni = -1;
    openAlumniModal(null);
  },
  'alumni-edit': (_e, [ai]) => {
    editingAlumni = ai;
    openAlumniModal(data().alumni[ai]);
  },
  'alumni-delete': async (_e, [ai]) => {
    const a = data().alumni[ai];
    if (!a) return;
    const ok = await confirm(`Remove alumni ${a.name}?`);
    if (!ok) return;
    data().alumni.splice(ai, 1);
    ctrl.markDirty();
    ctrl.rerender();
  },
};

// ── Contenteditable section titles (focusout — blur doesn't bubble) ──
function bindContenteditableTitles(root) {
  if (root.__teamTitleListener) return;
  root.__teamTitleListener = true;
  root.addEventListener('focusout', (event) => {
    const el = event.target.closest('[data-rename-section]');
    if (!el) return;
    const si = Number(el.dataset.renameSection);
    const newTitle = el.textContent.trim();
    const section = data().sections[si];
    if (!section || section.title === newTitle) return;
    section.title = newTitle;
    ctrl.markDirty();
  });
}

// ── Drag and drop (team-specific) ────────────────────────────
function setupDragDrop() {
  // Section reorder — handle is the drag source, .section-block is the drop target.
  document.querySelectorAll('.section-drag-handle').forEach(handle => {
    handle.addEventListener('dragstart', e => {
      dragSrc = { type: 'section', si: +handle.dataset.si };
      e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation();
      setTimeout(() => handle.closest('.section-block')?.classList.add('dragging'), 0);
    });
    handle.addEventListener('dragend', () => {
      document.querySelectorAll('.section-block.dragging').forEach(el => el.classList.remove('dragging'));
      dragSrc = null;
    });
  });

  document.querySelectorAll('.section-block').forEach(block => {
    block.addEventListener('dragover', e => {
      if (dragSrc?.type !== 'section') return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.section-block.drag-over').forEach(el => el.classList.remove('drag-over'));
      block.classList.add('drag-over');
    });
    block.addEventListener('dragleave', e => {
      if (!block.contains(e.relatedTarget)) block.classList.remove('drag-over');
    });
    block.addEventListener('drop', e => {
      e.preventDefault();
      block.classList.remove('drag-over');
      if (!dragSrc || dragSrc.type !== 'section') return;
      const to = +block.dataset.si;
      if (dragSrc.si === to) return;
      moveBefore(data().sections, dragSrc.si, to);
      dragSrc = null;
      ctrl.markDirty();
      ctrl.rerender();
    });
  });

  // Member card reorder within the same section.
  document.querySelectorAll('.card-base[draggable]').forEach(cardEl => {
    cardEl.addEventListener('dragstart', e => {
      e.stopPropagation();
      dragSrc = { type: 'member', si: +cardEl.dataset.si, mi: +cardEl.dataset.mi };
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => cardEl.classList.add('dragging'), 0);
    });
    cardEl.addEventListener('dragend', () => {
      cardEl.classList.remove('dragging');
      dragSrc = null;
    });
    cardEl.addEventListener('dragover', e => {
      if (dragSrc?.type !== 'member' || dragSrc.si !== +cardEl.dataset.si) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.card-base.drag-over').forEach(el => el.classList.remove('drag-over'));
      if (dragSrc.mi !== +cardEl.dataset.mi) cardEl.classList.add('drag-over');
    });
    cardEl.addEventListener('dragleave', () => cardEl.classList.remove('drag-over'));
    cardEl.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      cardEl.classList.remove('drag-over');
      if (!dragSrc || dragSrc.type !== 'member') return;
      const toSi = +cardEl.dataset.si;
      const toMi = +cardEl.dataset.mi;
      if (dragSrc.si !== toSi || dragSrc.mi === toMi) return;
      moveBefore(data().sections[toSi].members, dragSrc.mi, toMi);
      dragSrc = null;
      ctrl.markDirty();
      ctrl.rerender();
    });
  });

  // Alumni row reorder.
  document.querySelectorAll('.alumni-row[draggable]').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragSrc = { type: 'alumni', ai: +row.dataset.ai };
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('dragging'), 0);
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      dragSrc = null;
    });
    row.addEventListener('dragover', e => {
      if (dragSrc?.type !== 'alumni') return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.alumni-row.drag-over').forEach(el => el.classList.remove('drag-over'));
      if (dragSrc.ai !== +row.dataset.ai) row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', e => {
      if (!row.contains(e.relatedTarget)) row.classList.remove('drag-over');
    });
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (!dragSrc || dragSrc.type !== 'alumni') return;
      const to = +row.dataset.ai;
      if (dragSrc.ai === to) return;
      moveBefore(data().alumni, dragSrc.ai, to);
      dragSrc = null;
      ctrl.markDirty();
      ctrl.rerender();
    });
  });
}


// ── Member modal ─────────────────────────────────────────────
function setupMemberModal() {
  document.getElementById('member-modal-close').addEventListener('click', () => closeModal('member-modal'));
  document.getElementById('member-modal-cancel').addEventListener('click', () => closeModal('member-modal'));
  document.getElementById('member-modal-save').addEventListener('click', saveMember);

  // One shared upload helper replaces what used to be 3 hand-rolled drop-zones.
  if (memberUploadHandle) memberUploadHandle.destroy();
  memberUploadHandle = attachUpload(document.getElementById('member-img-area'), {
    pathPrefix: 'images',
    preview: document.getElementById('member-img-preview'),
    hiddenField: document.getElementById('member-image'),
    fileInput: document.getElementById('member-img-input'),
  });
}

function openMemberModal(member) {
  const isNew = !member;
  document.getElementById('member-modal-title').textContent = isNew ? t('add_member_title') : t('edit_member');
  document.getElementById('member-name').value = member?.name || '';
  document.getElementById('member-role').value = member?.role || '';
  document.getElementById('member-email').value = member?.email || '';
  document.getElementById('member-link').value = member?.link || '';
  document.getElementById('member-bio').value = member?.bio || '';
  document.getElementById('member-image').value = member?.image || '';
  setUploadPreview(document.getElementById('member-img-preview'), member?.image, 'images');
  const research = Array.isArray(member?.research_area)
    ? member.research_area.join(', ')
    : member?.research_area || '';
  document.getElementById('member-research-area').value = research;
  openModal('member-modal');
}

function saveMember() {
  const { si, mi } = editingMember;
  const m = {
    name: document.getElementById('member-name').value.trim(),
    role: document.getElementById('member-role').value.trim(),
    email: document.getElementById('member-email').value.trim() || undefined,
    link: document.getElementById('member-link').value.trim() || undefined,
    bio: document.getElementById('member-bio').value.trim() || undefined,
    image: document.getElementById('member-image').value.trim() || undefined,
    research_area: document.getElementById('member-research-area').value.trim() || undefined,
  };
  Object.keys(m).forEach(k => m[k] === undefined && delete m[k]);
  const sections = data().sections;
  if (mi === -1) sections[si].members.push(m);
  else sections[si].members[mi] = m;
  closeModal('member-modal');
  ctrl.markDirty();
  ctrl.rerender();
}

// ── Alumni modal ─────────────────────────────────────────────
function setupAlumniModal() {
  document.getElementById('alumni-modal-close').addEventListener('click', () => closeModal('alumni-modal'));
  document.getElementById('alumni-modal-cancel').addEventListener('click', () => closeModal('alumni-modal'));
  document.getElementById('alumni-modal-save').addEventListener('click', saveAlumni);
}

function openAlumniModal(a) {
  document.getElementById('alumni-modal-title').textContent = a ? t('edit_alumni') : t('add_alumni_title');
  document.getElementById('alumni-name').value = a?.name || '';
  document.getElementById('alumni-role').value = a?.role || '';
  document.getElementById('alumni-link').value = a?.link || '';
  openModal('alumni-modal');
}

function saveAlumni() {
  const a = {
    name: document.getElementById('alumni-name').value.trim(),
    role: document.getElementById('alumni-role').value.trim() || undefined,
    link: document.getElementById('alumni-link').value.trim() || undefined,
  };
  Object.keys(a).forEach(k => a[k] === undefined && delete a[k]);
  const alumni = data().alumni;
  if (editingAlumni === -1) alumni.push(a);
  else alumni[editingAlumni] = a;
  closeModal('alumni-modal');
  ctrl.markDirty();
  ctrl.rerender();
}
