import { githubGetFile, githubUpdateFile, githubUploadImage, decodeGithubContent, toast, openModal, closeModal, initTagInput, confirm } from '../admin.js';

let projectsData = null;
let editingProject = null; // { si, pi } or null

export async function initProjectsEditor() {
  const section = document.getElementById('section-projects');
  section.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Projects</div>
        <div class="section-desc">Manage active and completed research projects</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="projects-refresh">↺ Refresh</button>
    </div>
    <div id="projects-body"><div class="empty-state"><div class="loader-spinner" style="margin:0 auto"></div></div></div>
    <div class="publish-bar">
      <span class="publish-bar-hint">Changes are saved locally until you publish</span>
      <button class="btn btn-accent" id="projects-publish">⬇ Publish Changes</button>
    </div>`;

  document.getElementById('projects-refresh').addEventListener('click', loadProjects);
  document.getElementById('projects-publish').addEventListener('click', publishProjects);
  setupProjectModal();
  await loadProjects();
}

async function loadProjects() {
  try {
    const file = await githubGetFile('_data/projects.json');
    projectsData = JSON.parse(decodeGithubContent(file.content));
    renderProjects();
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
      <label style="font-size:0.78rem;font-weight:500;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em">Intro Text</label>
      <textarea id="projects-intro" style="width:100%;margin-top:0.35rem;padding:0.6rem 0.85rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);min-height:60px;resize:vertical;font-family:var(--font);font-size:0.85rem" onchange="window._projIntroChange(this.value)">${projectsData.intro || ''}</textarea>
    </div>`;

  projectsData.sections.forEach((sec, si) => {
    html += `
      <div class="group-header">
        <div class="group-title" contenteditable="true" onblur="window._projSectionRename(this,${si})">${sec.title}</div>
        <div class="group-actions">
          <button class="btn btn-ghost btn-sm" onclick="window._projAddProject(${si})">+ Add Project</button>
          <button class="btn btn-danger btn-sm" onclick="window._projDeleteSection(${si})">Delete Section</button>
        </div>
      </div>`;
    (sec.projects || []).forEach((p, pi) => {
      const imgSrc = p.image ? `${BASE}/assets/img/sub/${p.image}` : '';
      html += `
        <div class="project-card">
          ${imgSrc ? `<img class="project-card-img" src="${imgSrc}" onerror="this.style.display='none'">` : '<div class="project-card-img" style="background:var(--surface2)"></div>'}
          <div class="project-card-body">
            <div class="project-card-title">${p.title || '—'}</div>
            <div class="project-card-meta">${p.timeline || ''} · ${p.status || ''}</div>
            ${p.funding_text ? `<div class="project-card-meta" style="margin-top:0.2rem">${p.funding_text}</div>` : ''}
          </div>
          <div class="project-card-actions">
            <button class="btn btn-ghost btn-sm" onclick="window._projEdit(${si},${pi})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="window._projDelete(${si},${pi})">✕</button>
          </div>
        </div>`;
    });
  });

  html += `
    <button class="btn btn-ghost btn-sm" style="margin-top:1rem" onclick="window._projAddSection()">+ Add Section</button>
    <div style="margin-top:1.25rem">
      <label style="font-size:0.78rem;font-weight:500;color:var(--text2);text-transform:uppercase;letter-spacing:0.05em">Collaboration CTA</label>
      <textarea id="projects-cta" style="width:100%;margin-top:0.35rem;padding:0.6rem 0.85rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);min-height:50px;resize:vertical;font-family:var(--font);font-size:0.85rem" onchange="window._projCtaChange(this.value)">${projectsData.collaborationCta || ''}</textarea>
    </div>`;

  body.innerHTML = html;
}

window._projIntroChange = (v) => { projectsData.intro = v; };
window._projCtaChange = (v) => { projectsData.collaborationCta = v; };
window._projSectionRename = (el, si) => { projectsData.sections[si].title = el.textContent.trim(); };
window._projAddSection = () => { projectsData.sections.push({ title: 'New Section', projects: [] }); renderProjects(); };
window._projDeleteSection = async (si) => {
  if (!await confirm(`Delete section "${projectsData.sections[si].title}"?`)) return;
  projectsData.sections.splice(si, 1); renderProjects();
};
window._projAddProject = (si) => { editingProject = { si, pi: -1 }; openProjectModal(si, null); };
window._projEdit = (si, pi) => { editingProject = { si, pi }; openProjectModal(si, projectsData.sections[si].projects[pi]); };
window._projDelete = async (si, pi) => {
  if (!await confirm(`Delete project "${projectsData.sections[si].projects[pi].title}"?`)) return;
  projectsData.sections[si].projects.splice(pi, 1); renderProjects();
};

let repsController = null;

function setupProjectModal() {
  document.getElementById('project-modal-close').addEventListener('click', () => closeModal('project-modal'));
  document.getElementById('project-modal-cancel').addEventListener('click', () => closeModal('project-modal'));
  document.getElementById('project-modal-save').addEventListener('click', saveProject);

  ['project-img-input', 'funding-img-input'].forEach((id, idx) => {
    const field = idx === 0 ? 'project-image' : 'project-funding-image';
    const folder = idx === 0 ? 'assets/img/sub' : 'assets/img/sub';
    document.getElementById(id).addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        await githubUploadImage(folder + '/' + file.name, file);
        document.getElementById(field).value = file.name;
        toast('Image uploaded', 'success');
      } catch (err) { toast('Upload failed: ' + err.message, 'error'); }
    });
  });
}

function openProjectModal(si, p) {
  document.getElementById('project-modal-title').textContent = p ? 'Edit Project' : 'Add Project';
  document.getElementById('project-title').value = p?.title || '';
  document.getElementById('project-timeline').value = p?.timeline || '';
  document.getElementById('project-status').value = p?.status || 'Ongoing';
  document.getElementById('project-image').value = p?.image || '';
  document.getElementById('project-image-alt').value = p?.image_alt || '';
  document.getElementById('project-funding-image').value = p?.funding_image || '';
  document.getElementById('project-funding-alt').value = p?.funding_alt || '';
  document.getElementById('project-funding-text').value = p?.funding_text || '';
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
  renderProjects();
}

async function publishProjects() {
  const btn = document.getElementById('projects-publish');
  btn.disabled = true; btn.textContent = 'Publishing…';
  try {
    await githubUpdateFile('_data/projects.json', JSON.stringify(projectsData, null, 2), 'admin: update projects data');
    toast('Projects published! Site will rebuild in ~1-2 min.', 'success');
  } catch (err) { toast('Publish failed: ' + err.message, 'error'); }
  btn.disabled = false; btn.textContent = '⬇ Publish Changes';
}
