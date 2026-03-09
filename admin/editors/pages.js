import { githubGetFile, githubUpdateFile, decodeGithubContent, toast } from '../admin.js';

const PAGES = [
  { id: 'about', path: 'about.md', label: 'About' },
  { id: 'contact', path: 'contact.md', label: 'Contact' },
  { id: 'joinus', path: 'joinus.md', label: 'Join Us' },
  { id: 'software', path: 'software.md', label: 'Software' },
];

const pageCache = {};
let activePageId = PAGES[0].id;
let previewMode = false;

// Minimal markdown → HTML for preview (no dependency)
function mdToHtml(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^---[\s\S]*?---\n?/m, '') // strip front matter
    .replace(/^######\s(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/^[-*]\s(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => '<ul>' + s + '</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '')
    .replace(/^(.+)$/gm, m => m.startsWith('<') ? m : '<p>' + m + '</p>');
}

export async function initPagesEditor() {
  const section = document.getElementById('section-pages');

  const tabsHtml = PAGES.map(p =>
    `<div class="pages-tab${p.id === activePageId ? ' active' : ''}" data-id="${p.id}">${p.label}</div>`
  ).join('');

  const editorsHtml = PAGES.map(p => `
    <div class="page-editor${p.id === activePageId ? ' active' : ''}" id="page-ed-${p.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
        <div style="display:flex;gap:0.35rem">
          <button class="btn btn-ghost btn-sm page-view-btn active" data-page="${p.id}" data-view="edit">Edit</button>
          <button class="btn btn-ghost btn-sm page-view-btn" data-page="${p.id}" data-view="preview">Preview</button>
          <button class="btn btn-ghost btn-sm page-view-btn" data-page="${p.id}" data-view="split">Split</button>
        </div>
        <div style="display:flex;gap:0.5rem">
          <button class="btn btn-ghost btn-sm" onclick="window._pageRefresh('${p.id}','${p.path}')">↺ Refresh</button>
          <button class="btn btn-accent btn-sm" onclick="window._pagePublish('${p.id}','${p.path}')">Publish</button>
        </div>
      </div>
      <div class="page-split-wrap" id="page-wrap-${p.id}">
        <textarea class="markdown-editor" id="page-textarea-${p.id}" placeholder="Loading…" readonly></textarea>
        <div class="markdown-preview" id="page-preview-${p.id}" style="display:none"></div>
      </div>
      <div style="margin-top:0.4rem;font-size:0.75rem;color:var(--text2);display:flex;justify-content:space-between" id="page-status-${p.id}"></div>
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

  section.querySelectorAll('.page-view-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.page, btn.dataset.view));
  });

  await loadPage(activePageId, PAGES[0].path);
}

function setView(pageId, view) {
  const textarea = document.getElementById('page-textarea-' + pageId);
  const preview = document.getElementById('page-preview-' + pageId);
  const wrap = document.getElementById('page-wrap-' + pageId);
  const btns = document.querySelectorAll(`.page-view-btn[data-page="${pageId}"]`);
  btns.forEach(b => b.classList.toggle('active', b.dataset.view === view));

  if (view === 'edit') {
    textarea.style.display = ''; preview.style.display = 'none';
    wrap.style.display = 'block';
  } else if (view === 'preview') {
    textarea.style.display = 'none'; preview.style.display = '';
    wrap.style.display = 'block';
    preview.innerHTML = `<div class="md-preview-body">${mdToHtml(textarea.value)}</div>`;
  } else { // split
    textarea.style.display = ''; preview.style.display = '';
    wrap.style.display = 'grid';
    preview.innerHTML = `<div class="md-preview-body">${mdToHtml(textarea.value)}</div>`;
  }
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
    const content = file ? decodeGithubContent(file.content) : '';
    pageCache[id] = { content, sha: file?.sha };
    textarea.value = content;
    textarea.readOnly = false;
    const lines = content.split('\n').length;
    const words = content.split(/\s+/).filter(Boolean).length;
    status.innerHTML = `<span>${lines} lines · ${words} words</span><span>${file ? 'Loaded from GitHub' : 'New file'}</span>`;
    textarea.addEventListener('input', () => {
      pageCache[id].content = textarea.value;
      // live update split preview if active
      const preview = document.getElementById('page-preview-' + id);
      if (preview.style.display !== 'none') {
        preview.innerHTML = `<div class="md-preview-body">${mdToHtml(textarea.value)}</div>`;
      }
    });
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
