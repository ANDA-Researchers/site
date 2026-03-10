import { githubGetFile, githubUpdateFile, githubUploadImage, decodeGithubContent, toast, openModal, closeModal, initTagInput, confirm, t, applyI18n } from '../admin.js';

let projectsData = null;
let editingProject = null;
let repsController = null;
let isDirty = false;

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
      <button class="btn btn-ghost btn-sm" id="projects-refresh"><span data-i18n="btn_refresh">Refresh</span></button>
    </div>
    <div id="projects-body"><div class="empty-state"><div class="loader-spinner" style="margin:0 auto"></div></div></div>
    <div class="publish-bar">
      <span class="publish-bar-hint" data-i18n="publish_hint">Changes are saved locally until you publish</span>
      <button class="btn btn-accent" id="projects-publish" disabled>
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"/><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/></svg>
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
    projectsData = file ? JSON.parse(decodeGithubContent(file.content)) : { sections: [] };
    renderProjects();
    clearDirty();
  } catch (err) {
    document.getElementById('projects-body').innerHTML = `<div class="alert alert-warning">Failed to load: ${err.message}</div>`;
  }
}

function renderProjects() {
  const body = document.getElementById('projects-body');
  if (!projectsData) return;
  const BASE = document.querySelector('meta[name="base-url"]')?.content || '';
  let html = `
    <div style="margin-bottom:1.25rem">
      <label style="font-size:0.78rem;font-weight:500;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em" data-i18n="intro_text">Intro Text</label>
      <textarea id="projects-intro" style="width:100%;margin-top:0.35rem;padding:0.6rem 0.85rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);min-height:60px;resize:vertical;font-family:var(--font);font-size:0.85rem" oninput="window._projIntroChange(this.value)">${projectsData.intro || ''}</textarea>
    </div>`;

  projectsData.sections.forEach((sec, si) => {
    html += `
      <div class="group-header">
        <div class="group-title" contenteditable="true" onblur="window._projSectionRename(this,${si})">${sec.title}</div>
        <div class="group-actions">
          <button class="btn btn-ghost btn-sm" onclick="window._projAddProject(${si})">${t('add_project')}</button>
          <button class="btn btn-danger btn-sm" onclick="window._projDeleteSection(${si})">${t('del_section')}</button>
        </div>
      </div>`;
    (sec.projects || []).forEach((p, pi) => {
      const imgSrc = p.image ? `${BASE}/images/sub/${p.image}` : '';
      html += `
        <div class="project-card">
          ${imgSrc ? `<img class="project-card-img" src="${imgSrc}" onerror="this.style.display='none'">` : '<div class="project-card-img" style="background:var(--surface2)"></div>'}
          <div class="project-card-body">
            <div class="project-card-title">${p.title || '—'}</div>
            <div class="project-card-meta">${p.timeline || ''} · ${p.status || ''}</div>
            ${p.funding_text ? `<div class="project-card-meta" style="margin-top:0.2rem">${p.funding_text}</div>` : ''}
          </div>
          <div class="project-card-actions">
            <button class="btn btn-ghost btn-sm" onclick="window._projEdit(${si},${pi})"><svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg></button>
            <button class="btn btn-danger btn-sm" onclick="window._projDelete(${si},${pi})">✕</button>
          </div>
        </div>`;
    });
  });

  html += `
    <button class="btn btn-ghost btn-sm" style="margin-top:1rem" onclick="window._projAddSection()">${t('add_section')}</button>
    <div style="margin-top:1.25rem">
      <label style="font-size:0.78rem;font-weight:500;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em" data-i18n="collab_cta">Collaboration CTA</label>
      <textarea id="projects-cta" style="width:100%;margin-top:0.35rem;padding:0.6rem 0.85rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);min-height:50px;resize:vertical;font-family:var(--font);font-size:0.85rem" oninput="window._projCtaChange(this.value)">${projectsData.collaborationCta || ''}</textarea>
      <div style="margin-top:0.35rem;font-size:0.75rem;color:var(--text2)">The site template automatically appends "<strong style="color:var(--text)">contact us</strong>" as a link after this text.</div>
    </div>`;

  body.innerHTML = html;
  applyI18n();
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
  try {
    area.style.opacity = '0.5';
    await githubUploadImage(folder + '/' + file.name, file);
    area.style.opacity = '1';
    document.getElementById(fieldId).value = file.name;
    toast('Image uploaded', 'success');
  } catch (err) { area.style.opacity = '1'; toast('Upload failed: ' + err.message, 'error'); }
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
  const BASE = document.querySelector('meta[name="base-url"]')?.content || '';
  const projPreview = document.getElementById('project-img-preview');
  const fundingPreview = document.getElementById('funding-img-preview');
  if (p?.image) { projPreview.src = `${BASE}/images/sub/${p.image}`; projPreview.classList.add('shown'); }
  else { projPreview.classList.remove('shown'); projPreview.src = ''; }
  if (p?.funding_image) { fundingPreview.src = `${BASE}/images/sub/${p.funding_image}`; fundingPreview.classList.add('shown'); }
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
    await githubUpdateFile('_data/projects.json', JSON.stringify(projectsData, null, 2), 'admin: update projects data');
    btn.innerHTML = origHTML;
    clearDirty();
    toast('Projects published! Site will rebuild in ~1-2 min.', 'success');
  } catch (err) {
    btn.innerHTML = origHTML; btn.disabled = false;
    toast('Publish failed: ' + err.message, 'error');
  }
}
