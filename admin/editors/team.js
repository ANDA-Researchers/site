import { githubGetFile, githubUpdateFile, githubUploadImage, decodeGithubContent, toast, openModal, closeModal, initTagInput, confirm } from '../admin.js';

let teamData = null;
let editingMember = null; // { sectionIdx, memberIdx } or null for new
let editingAlumni = null;
let tagsController = null;

export async function initTeamEditor() {
  const section = document.getElementById('section-team');
  section.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Team Members</div>
        <div class="section-desc">Manage lab members, sections, and alumni</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="team-refresh">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H5.498a.75.75 0 00-.75.75v3.475a.75.75 0 001.5 0v-1.324l.37.37a7 7 0 0011.722-3.138.75.75 0 00-1.442-.282zM10.47 5.05A7 7 0 003.058 8.26a.75.75 0 101.47.286 5.5 5.5 0 019.187-2.334l.31.31H11.5a.75.75 0 000 1.5h3.475a.75.75 0 00.75-.75V3.807a.75.75 0 00-1.5 0v1.324l-.354-.354A7 7 0 0010.47 5.05z" clip-rule="evenodd"/></svg>
        Refresh
      </button>
    </div>
    <div id="team-body">
      <div class="empty-state"><div class="loader-spinner" style="margin:0 auto"></div></div>
    </div>
    <div class="publish-bar">
      <span class="publish-bar-hint">Changes are saved locally until you publish</span>
      <button class="btn btn-accent" id="team-publish">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"/><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/></svg>
        Publish Changes
      </button>
    </div>`;

  document.getElementById('team-refresh').addEventListener('click', loadTeam);
  document.getElementById('team-publish').addEventListener('click', publishTeam);
  setupTeamModal();
  setupAlumniModal();
  await loadTeam();
}

async function loadTeam() {
  try {
    const file = await githubGetFile('_data/team.json');
    teamData = file ? JSON.parse(decodeGithubContent(file.content)) : { sections: [], alumni: [] };
    renderTeam();
  } catch (err) {
    document.getElementById('team-body').innerHTML = `<div class="alert alert-warning">Failed to load: ${err.message}</div>`;
  }
}

function renderTeam() {
  const body = document.getElementById('team-body');
  if (!teamData) return;
  let html = '';

  teamData.sections.forEach((sec, si) => {
    html += `
      <div class="group-header" data-si="${si}">
        <div class="group-title" contenteditable="true" data-si="${si}" onblur="window._teamSectionRename(this, ${si})">${sec.title}</div>
        <div class="group-actions">
          <button class="btn btn-ghost btn-sm" onclick="window._teamAddMember(${si})">+ Add Member</button>
          <button class="btn btn-danger btn-sm" onclick="window._teamDeleteSection(${si})">Delete Section</button>
        </div>
      </div>
      <div class="items-grid" id="team-grid-${si}">`;
    (sec.members || []).forEach((m, mi) => {
      const imgSrc = m.image ? `${document.querySelector('meta[name="base-url"]')?.content || ''}/images/${m.image}` : '';
      html += `
        <div class="item-card">
          <div class="item-card-actions">
            <button class="btn btn-ghost btn-sm" onclick="window._teamEditMember(${si},${mi})">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="window._teamDeleteMember(${si},${mi})">✕</button>
          </div>
          ${imgSrc ? `<img class="item-card-img" src="${imgSrc}" onerror="this.style.display='none'">` : '<div class="item-card-img-placeholder">👤</div>'}
          <div class="item-card-name">${m.name || '—'}</div>
          <div class="item-card-role">${m.role || ''}</div>
        </div>`;
    });
    html += `</div>`;
  });

  // Alumni
  html += `
    <div class="group-header">
      <div class="group-title">Alumni</div>
      <div class="group-actions">
        <button class="btn btn-ghost btn-sm" onclick="window._teamAddAlumni()">+ Add Alumni</button>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.75rem">`;
  (teamData.alumni || []).forEach((a, ai) => {
    html += `
      <div style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.4rem 0.75rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;font-size:0.82rem">
        <span>${a.name}${a.role ? ' · ' + a.role : ''}</span>
        <button class="btn btn-ghost btn-sm" style="padding:0 0.2rem" onclick="window._teamEditAlumni(${ai})">✏️</button>
        <button class="btn btn-danger btn-sm" style="padding:0 0.2rem" onclick="window._teamDeleteAlumni(${ai})">✕</button>
      </div>`;
  });
  html += `</div>
    <button class="btn btn-ghost btn-sm" style="margin-top:1rem" onclick="window._teamAddSection()">+ Add Section</button>`;

  body.innerHTML = html;
}

// ── Global handlers (called from inline onclick) ──────────────
window._teamSectionRename = (el, si) => { teamData.sections[si].title = el.textContent.trim(); };
window._teamAddSection = () => {
  teamData.sections.push({ title: 'New Section', members: [] });
  renderTeam();
};
window._teamDeleteSection = async (si) => {
  if (!await confirm(`Delete section "${teamData.sections[si].title}" and all its members?`)) return;
  teamData.sections.splice(si, 1);
  renderTeam();
};
window._teamAddMember = (si) => { editingMember = { si, mi: -1 }; openMemberModal(si, null); };
window._teamEditMember = (si, mi) => { editingMember = { si, mi }; openMemberModal(si, teamData.sections[si].members[mi]); };
window._teamDeleteMember = async (si, mi) => {
  const m = teamData.sections[si].members[mi];
  if (!await confirm(`Remove ${m.name}?`)) return;
  teamData.sections[si].members.splice(mi, 1);
  renderTeam();
};
window._teamAddAlumni = () => { editingAlumni = -1; openAlumniModal(null); };
window._teamEditAlumni = (ai) => { editingAlumni = ai; openAlumniModal(teamData.alumni[ai]); };
window._teamDeleteAlumni = async (ai) => {
  const a = teamData.alumni[ai];
  if (!await confirm(`Remove alumni ${a.name}?`)) return;
  teamData.alumni.splice(ai, 1);
  renderTeam();
};

// ── Member Modal ──────────────────────────────────────────────
function setupTeamModal() {
  document.getElementById('member-modal-close').addEventListener('click', () => closeModal('member-modal'));
  document.getElementById('member-modal-cancel').addEventListener('click', () => closeModal('member-modal'));
  document.getElementById('member-modal-save').addEventListener('click', saveMember);

  const area = document.getElementById('member-img-area');
  const preview = document.getElementById('member-img-preview');
  area.addEventListener('click', () => document.getElementById('member-img-input').click());
  document.getElementById('member-img-input').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (r) => { preview.src = r.target.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);
    try {
      area.style.opacity = '0.5';
      await githubUploadImage('images/' + file.name, file);
      area.style.opacity = '1';
      document.getElementById('member-image').value = file.name;
      toast('Image uploaded', 'success');
    } catch (err) { area.style.opacity = '1'; toast('Upload failed: ' + err.message, 'error'); }
  });
}

function openMemberModal(si, member) {
  const isNew = !member;
  document.getElementById('member-modal-title').textContent = isNew ? 'Add Member' : 'Edit Member';
  document.getElementById('member-name').value = member?.name || '';
  document.getElementById('member-role').value = member?.role || '';
  document.getElementById('member-email').value = member?.email || '';
  document.getElementById('member-link').value = member?.link || '';
  document.getElementById('member-bio').value = member?.bio || '';
  document.getElementById('member-image').value = member?.image || '';
  const BASE = document.querySelector('meta[name="base-url"]')?.content || '';
  const preview = document.getElementById('member-img-preview');
  if (member?.image) { preview.src = BASE + '/images/' + member.image; preview.style.display = 'block'; }
  else { preview.style.display = 'none'; }
  if (!tagsController) {
    tagsController = initTagInput(document.getElementById('member-research-tags'), member?.research_area || []);
  } else {
    tagsController.setValues(member?.research_area || []);
  }
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
    research_area: tagsController?.getValues() || [],
  };
  Object.keys(m).forEach(k => m[k] === undefined && delete m[k]);
  if (mi === -1) teamData.sections[si].members.push(m);
  else teamData.sections[si].members[mi] = m;
  closeModal('member-modal');
  renderTeam();
}

// ── Alumni Modal ──────────────────────────────────────────────
function setupAlumniModal() {
  document.getElementById('alumni-modal-close').addEventListener('click', () => closeModal('alumni-modal'));
  document.getElementById('alumni-modal-cancel').addEventListener('click', () => closeModal('alumni-modal'));
  document.getElementById('alumni-modal-save').addEventListener('click', saveAlumni);
}
function openAlumniModal(a) {
  document.getElementById('alumni-modal-title').textContent = a ? 'Edit Alumni' : 'Add Alumni';
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
  if (editingAlumni === -1) teamData.alumni.push(a);
  else teamData.alumni[editingAlumni] = a;
  closeModal('alumni-modal');
  renderTeam();
}

// ── Publish ───────────────────────────────────────────────────
async function publishTeam() {
  const btn = document.getElementById('team-publish');
  btn.disabled = true; btn.textContent = 'Publishing…';
  try {
    await githubUpdateFile('_data/team.json', JSON.stringify(teamData, null, 2), 'admin: update team data');
    toast('Team published! Site will rebuild in ~1-2 min.', 'success');
  } catch (err) {
    toast('Publish failed: ' + err.message, 'error');
  }
  btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"/><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/></svg> Publish Changes`;
}
