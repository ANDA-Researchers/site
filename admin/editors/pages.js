import { githubGetFile, githubUpdateFile, decodeGithubContent, toast } from '../admin.js';

const PAGES = [
  { id: 'about', path: 'about.md', label: 'About' },
  { id: 'contact', path: 'contact.md', label: 'Contact' },
  { id: 'joinus', path: 'joinus.md', label: 'Join Us' },
  { id: 'software', path: 'software.md', label: 'Software' },
];

const pageCache = {};
let activePageId = PAGES[0].id;

export async function initPagesEditor() {
  const section = document.getElementById('section-pages');
  let tabsHtml = PAGES.map(p =>
    `<div class="pages-tab${p.id === activePageId ? ' active' : ''}" data-id="${p.id}">${p.label}</div>`
  ).join('');

  let editorsHtml = PAGES.map(p => `
    <div class="page-editor${p.id === activePageId ? ' active' : ''}" id="page-ed-${p.id}">
      <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-bottom:0.75rem">
        <button class="btn btn-ghost btn-sm" onclick="window._pageRefresh('${p.id}','${p.path}')">↺ Refresh</button>
        <button class="btn btn-accent btn-sm" onclick="window._pagePublish('${p.id}','${p.path}')">⬇ Publish</button>
      </div>
      <textarea class="markdown-editor" id="page-textarea-${p.id}" placeholder="Loading…" readonly></textarea>
      <div style="margin-top:0.4rem;font-size:0.75rem;color:var(--text2)" id="page-status-${p.id}"></div>
    </div>`).join('');

  section.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Page Content</div>
        <div class="section-desc">Edit markdown content for site pages</div>
      </div>
    </div>
    <div class="pages-tabs">${tabsHtml}</div>
    ${editorsHtml}`;

  section.querySelectorAll('.pages-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.id));
  });

  // Load first page
  await loadPage(activePageId, PAGES[0].path);
}

async function switchTab(id) {
  activePageId = id;
  document.querySelectorAll('.pages-tab').forEach(t => t.classList.toggle('active', t.dataset.id === id));
  document.querySelectorAll('.page-editor').forEach(e => e.classList.toggle('active', e.id === 'page-ed-' + id));
  const page = PAGES.find(p => p.id === id);
  if (!pageCache[id]) await loadPage(id, page.path);
}

async function loadPage(id, path) {
  const textarea = document.getElementById('page-textarea-' + id);
  const status = document.getElementById('page-status-' + id);
  textarea.value = 'Loading…'; textarea.readOnly = true;
  try {
    const file = await githubGetFile(path);
    const content = decodeGithubContent(file.content);
    pageCache[id] = { content, sha: file.sha };
    textarea.value = content;
    textarea.readOnly = false;
    textarea.addEventListener('input', () => { pageCache[id].content = textarea.value; });
    status.textContent = `Last modified: ${new Date(file.last_modified || '').toLocaleString() || 'unknown'}`;
  } catch (err) {
    textarea.value = 'Failed to load: ' + err.message;
    status.textContent = '';
  }
}

window._pageRefresh = async (id, path) => {
  delete pageCache[id];
  await loadPage(id, path);
  toast('Refreshed', 'info');
};

window._pagePublish = async (id, path) => {
  const cached = pageCache[id];
  if (!cached) return toast('No content loaded', 'error');
  try {
    await githubUpdateFile(path, cached.content, `admin: update ${path}`);
    toast('Published! Site rebuilds in ~1-2 min.', 'success');
  } catch (err) {
    toast('Publish failed: ' + err.message, 'error');
  }
};
