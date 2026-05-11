import { githubGetFile, githubUpdateFile, githubUploadImage, decodeGithubContent, toast, openModal, closeModal, initTagInput, confirm, t, applyI18n, escapeHtml, sanitizeFilename, BASE } from '../admin.js';
import { icon } from '../ui.js';
import { moveBefore } from '../editor-base.js';

let projectsData = null;
let projectsSha = null;
let editingProject = null;
let repsController = null;
let isDirty = false;
let dragSrc = null; // { type: 'section'|'project', si?, pi? }

function markDirty() {
  isDirty = true;
  const btn = document.getElementById('projects-publish');
  if (btn) btn.disabled = false;
}

function clearDirty() {
  isDirty = false;
  const btn = document.getElementById('projects-publish');
  if (btn) btn.disabled = true;
}

export async function initProjectsEditor() {
  const section = document.getElementById('section-projects');
  section.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title" data-i18n="projects_title">Projects</div>
        <div class="section-desc" data-i18n="projects_desc">Manage active and completed research projects</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="projects-refresh">${icon('refresh')}<span data-i18n="btn_refresh">Refresh</span></button>
    </div>
    <div id="projects-body"><div class="empty-state"><div class="loader-spinner" style="margin:0 auto"></div></div></div>
    <div class="publish-bar">
      <span class="publish-bar-hint" data-i18n="publish_hint">Changes are saved locally until you publish</span>
      <button class="btn btn-accent" id="projects-publish" disabled>
        ${icon('publish')}
        <span data-i18n="publish_btn">Publish Changes</span>
      </button>
    </div>`;

  applyI18n();
  document.getElementById('projects-refresh').addEventListener('click', loadProjects);
  document.getElementById('projects-publish').addEventListener('click', publishProjects);
  setupProjectModal();
  await loadProjects();
}

async function loadProjects() {
  try {
    const file = await githubGetFile('_data/projects.json');
    projectsSha = file?.sha || null;
    projectsData = file ? JSON.parse(decodeGithubContent(file.content)) : { sections: [] };
    renderProjects();
    clearDirty();
  } catch (err) {
    document.getElementById('projects-body').innerHTML = `<div class="alert alert-warning">Failed to load: ${escapeHtml(err.message)}</div>`;
  }
}

function renderProjects() {
  const body = document.getElementById('projects-body');
  if (!projectsData) return;
  let html = `
    <div style="margin-bottom:1.25rem">
      <label style="font-size:0.78rem;font-weight:500;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em" data-i18n="intro_text">Intro Text</label>
      <textarea id="projects-intro" style="width:100%;margin-top:0.35rem;padding:0.6rem 0.85rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);min-height:60px;resize:vertical;font-family:var(--font);font-size:0.85rem" oninput="window._projIntroChange(this.value)">${escapeHtml(projectsData.intro) || ''}</textarea>
    </div>`;

  const reorderLabel = escapeHtml(t('drag_to_reorder'));
  projectsData.sections.forEach((sec, si) => {
    html += `
      <div class="section-block" data-si="${si}">
        <div class="group-header">
          <span class="grip section-drag-handle" draggable="true" data-si="${si}" title="${reorderLabel}" aria-label="${reorderLabel}">${icon('grip')}</span>
          <div class="group-title" contenteditable="true" onblur="window._projSectionRename(this,${si})">${escapeHtml(sec.title)}</div>
          <div class="group-actions">
            <button class="btn btn-ghost btn-sm" onclick="window._projAddProject(${si})">${icon('plus')}<span>${escapeHtml(t('add_project'))}</span></button>
            <button class="btn btn-danger btn-sm" onclick="window._projDeleteSection(${si})" aria-label="${escapeHtml(t('del_section'))}">${icon('delete')}</button>
          </div>
        </div>
        <div class="project-list">`;
    (sec.projects || []).forEach((p, pi) => {
      const imgSrc = p.image ? `${BASE}/images/sub/${encodeURIComponent(p.image)}` : '';
      html += `
          <div class="project-card" draggable="true" data-si="${si}" data-pi="${pi}">
            <span class="grip grip--card" title="${reorderLabel}" aria-hidden="true">${icon('grip')}</span>
            ${imgSrc ? `<img class="project-card-img" src="${imgSrc}" onerror="this.style.display='none'">` : '<div class="project-card-img" style="background:var(--surface2)"></div>'}
            <div class="project-card-body">
              <div class="project-card-title">${escapeHtml(p.title) || '—'}</div>
              <div class="project-card-meta">${escapeHtml(p.timeline) || ''} · ${escapeHtml(p.status) || ''}</div>
              ${p.funding_text ? `<div class="project-card-meta" style="margin-top:0.2rem">${escapeHtml(p.funding_text)}</div>` : ''}
            </div>
            <div class="project-card-actions">
              <button class="btn btn-ghost btn-sm" onclick="window._projEdit(${si},${pi})" aria-label="Edit">${icon('edit')}</button>
              <button class="btn btn-danger btn-sm" onclick="window._projDelete(${si},${pi})" aria-label="Delete">${icon('delete')}</button>
            </div>
          </div>`;
    });
    html += `
        </div>
      </div>`;
  });

  html += `
    <button class="btn btn-ghost btn-sm" style="margin-top:1rem" onclick="window._projAddSection()">${icon('plus')}<span>${escapeHtml(t('add_section'))}</span></button>
    <div style="margin-top:1.25rem">
      <label style="font-size:0.78rem;font-weight:500;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em" data-i18n="collab_cta">Collaboration CTA</label>
      <textarea id="projects-cta" style="width:100%;margin-top:0.35rem;padding:0.6rem 0.85rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);min-height:50px;resize:vertical;font-family:var(--font);font-size:0.85rem" oninput="window._projCtaChange(this.value)">${escapeHtml(projectsData.collaborationCta) || ''}</textarea>
      <div style="margin-top:0.35rem;font-size:0.75rem;color:var(--text2)">The site template automatically appends "<strong style="color:var(--text)">contact us</strong>" as a link after this text.</div>
    </div>`;

  body.innerHTML = html;
  applyI18n();
  setupDragDrop();
}

// ── Drag-and-drop for sections + project cards ──────────────────
function setupDragDrop() {
  // Section reorder.
  document.querySelectorAll('#projects-body .section-drag-handle').forEach(handle => {
    handle.addEventListener('dragstart', e => {
      dragSrc = { type: 'section', si: +handle.dataset.si };
      e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation();
      setTimeout(() => handle.closest('.section-block')?.classList.add('dragging'), 0);
    });
    handle.addEventListener('dragend', () => {
      document.querySelectorAll('#projects-body .section-block.dragging').forEach(el => el.classList.remove('dragging'));
      dragSrc = null;
    });
  });
  document.querySelectorAll('#projects-body .section-block').forEach(block => {
    block.addEventListener('dragover', e => {
      if (dragSrc?.type !== 'section') return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('#projects-body .section-block.drag-over').forEach(el => el.classList.remove('drag-over'));
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
      moveBefore(projectsData.sections, dragSrc.si, to);
      dragSrc = null;
      markDirty();
      renderProjects();
    });
  });

  // Project card reorder within the same section.
  document.querySelectorAll('#projects-body .project-card[draggable]').forEach(cardEl => {
    cardEl.addEventListener('dragstart', e => {
      e.stopPropagation();
      dragSrc = { type: 'project', si: +cardEl.dataset.si, pi: +cardEl.dataset.pi };
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => cardEl.classList.add('dragging'), 0);
    });
    cardEl.addEventListener('dragend', () => {
      cardEl.classList.remove('dragging');
      dragSrc = null;
    });
    cardEl.addEventListener('dragover', e => {
      if (dragSrc?.type !== 'project' || dragSrc.si !== +cardEl.dataset.si) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('#projects-body .project-card.drag-over').forEach(el => el.classList.remove('drag-over'));
      if (dragSrc.pi !== +cardEl.dataset.pi) cardEl.classList.add('drag-over');
    });
    cardEl.addEventListener('dragleave', () => cardEl.classList.remove('drag-over'));
    cardEl.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      cardEl.classList.remove('drag-over');
      if (!dragSrc || dragSrc.type !== 'project') return;
      const toSi = +cardEl.dataset.si;
      const toPi = +cardEl.dataset.pi;
      if (dragSrc.si !== toSi || dragSrc.pi === toPi) return;
      moveBefore(projectsData.sections[toSi].projects, dragSrc.pi, toPi);
      dragSrc = null;
      markDirty();
      renderProjects();
    });
  });
}

window._projIntroChange = (v) => { projectsData.intro = v; markDirty(); };
window._projCtaChange = (v) => { projectsData.collaborationCta = v; markDirty(); };
window._projSectionRename = (el, si) => { projectsData.sections[si].title = el.textContent.trim(); markDirty(); };
window._projAddSection = () => { projectsData.sections.push({ title: 'New Section', projects: [] }); markDirty(); renderProjects(); };
window._projDeleteSection = async (si) => {
  if (!await confirm(`Delete section "${projectsData.sections[si].title}"?`)) return;
  projectsData.sections.splice(si, 1); markDirty(); renderProjects();
};
window._projAddProject = (si) => { editingProject = { si, pi: -1 }; openProjectModal(si, null); };
window._projEdit = (si, pi) => { editingProject = { si, pi }; openProjectModal(si, projectsData.sections[si].projects[pi]); };
window._projDelete = async (si, pi) => {
  if (!await confirm(`Delete project "${projectsData.sections[si].projects[pi].title}"?`)) return;
  projectsData.sections[si].projects.splice(pi, 1); markDirty(); renderProjects();
};

function setupProjectModal() {
  document.getElementById('project-modal-close').addEventListener('click', () => closeModal('project-modal'));
  document.getElementById('project-modal-cancel').addEventListener('click', () => closeModal('project-modal'));
  document.getElementById('project-modal-save').addEventListener('click', saveProject);

  // Upload areas
  [['project-img-area', 'project-img-input', 'project-img-preview', 'project-image', 'images/sub'],
   ['funding-img-area', 'funding-img-input', 'funding-img-preview', 'project-funding-image', 'images/sub']
  ].forEach(([areaId, inputId, previewId, fieldId, folder]) => {
    const area = document.getElementById(areaId);
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    area.addEventListener('click', (e) => { if (e.target !== input) input.click(); });
    area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
    area.addEventListener('dragleave', () => area.classList.remove('dragover'));
    area.addEventListener('drop', async (e) => {
      e.preventDefault(); area.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleImageFile(file, area, preview, fieldId, folder);
    });
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleImageFile(file, area, preview, fieldId, folder);
    });
  });
}

async function handleImageFile(file, area, preview, fieldId, folder) {
  const reader = new FileReader();
  reader.onload = (r) => { preview.src = r.target.result; preview.classList.add('shown'); };
  reader.readAsDataURL(file);
  const safeName = sanitizeFilename(file.name);
  try {
    area.style.opacity = '0.5';
    area.style.pointerEvents = 'none';
    await githubUploadImage(folder + '/' + safeName, file);
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

function openProjectModal(si, p) {
  document.getElementById('project-modal-title').textContent = p ? t('edit_project') : t('add_project_title');
  document.getElementById('project-title').value = p?.title || '';
  document.getElementById('project-timeline').value = p?.timeline || '';
  document.getElementById('project-status').value = p?.status || 'Ongoing';
  document.getElementById('project-image').value = p?.image || '';
  document.getElementById('project-image-alt').value = p?.image_alt || '';
  document.getElementById('project-funding-image').value = p?.funding_image || '';
  document.getElementById('project-funding-alt').value = p?.funding_alt || '';
  document.getElementById('project-funding-text').value = p?.funding_text || '';

  // Populate image previews
  const projPreview = document.getElementById('project-img-preview');
  const fundingPreview = document.getElementById('funding-img-preview');
  if (p?.image) { projPreview.src = `${BASE}/images/sub/${encodeURIComponent(p.image)}`; projPreview.classList.add('shown'); }
  else { projPreview.classList.remove('shown'); projPreview.src = ''; }
  if (p?.funding_image) { fundingPreview.src = `${BASE}/images/sub/${encodeURIComponent(p.funding_image)}`; fundingPreview.classList.add('shown'); }
  else { fundingPreview.classList.remove('shown'); fundingPreview.src = ''; }

  repsController = initTagInput(document.getElementById('project-reps-tags'), p?.representatives || []);
  openModal('project-modal');
}

function saveProject() {
  const { si, pi } = editingProject;
  const p = {
    title: document.getElementById('project-title').value.trim(),
    timeline: document.getElementById('project-timeline').value.trim(),
    status: document.getElementById('project-status').value,
    representatives: repsController?.getValues() || [],
    image: document.getElementById('project-image').value.trim() || undefined,
    image_alt: document.getElementById('project-image-alt').value.trim() || undefined,
    funding_image: document.getElementById('project-funding-image').value.trim() || undefined,
    funding_alt: document.getElementById('project-funding-alt').value.trim() || undefined,
    funding_text: document.getElementById('project-funding-text').value.trim() || undefined,
  };
  Object.keys(p).forEach(k => p[k] === undefined && delete p[k]);
  if (pi === -1) projectsData.sections[si].projects.push(p);
  else projectsData.sections[si].projects[pi] = p;
  closeModal('project-modal');
  markDirty(); renderProjects();
}

async function publishProjects() {
  if (!isDirty) return;
  const btn = document.getElementById('projects-publish');
  const origHTML = btn.innerHTML;
  btn.disabled = true; btn.textContent = t('publishing');
  try {
    const result = await githubUpdateFile('_data/projects.json', JSON.stringify(projectsData, null, 2), 'admin: update projects data', projectsSha);
    if (result?.content?.sha) projectsSha = result.content.sha;
    btn.innerHTML = origHTML;
    clearDirty();
    toast('Projects published! Site will rebuild in ~1-2 min.', 'success');
  } catch (err) {
    btn.innerHTML = origHTML; btn.disabled = false;
    toast('Publish failed: ' + err.message, 'error');
  }
}
