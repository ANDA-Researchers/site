import { edgeCall, githubGetFile, decodeGithubContent, toast } from '../admin.js';

const WORKFLOW = 'update-publications.yml';

export async function initPublicationsEditor() {
  const section = document.getElementById('section-publications');
  section.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Publications</div>
        <div class="section-desc">Publication data is managed automatically by a scheduled GitHub Actions workflow.</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-header">
        <span class="card-title">Sync Publications</span>
      </div>
      <p style="color:var(--text2);font-size:0.875rem;margin:0 0 1rem">
        Trigger the publication sync workflow on demand. It fetches the latest papers from Google Scholar
        and updates <code style="background:var(--surface2);padding:0.1em 0.4em;border-radius:4px">_data/publications.json</code>.
        The site will rebuild automatically (~1–2 min) after the workflow completes.
      </p>
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
        <button class="btn btn-accent" id="pub-sync-btn">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style="margin-right:0.4rem">
            <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clip-rule="evenodd"/>
          </svg>
          Sync Publications Now
        </button>
        <span id="pub-sync-status" style="font-size:0.82rem;color:var(--text2)"></span>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Recent Publications</span></div>
      <div id="pub-preview" style="color:var(--text2);font-size:0.82rem">Loading…</div>
    </div>
  `;

  document.getElementById('pub-sync-btn').addEventListener('click', syncPublications);

  await loadPublicationsPreview();
}

async function syncPublications() {
  const btn = document.getElementById('pub-sync-btn');
  const status = document.getElementById('pub-sync-status');
  btn.disabled = true;
  btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style="margin-right:0.4rem;animation:spin 1s linear infinite"><path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clip-rule="evenodd"/></svg>Dispatching…`;
  status.textContent = '';

  try {
    const result = await edgeCall('github-proxy', { action: 'dispatch_workflow', workflow: WORKFLOW, ref: 'main' });
    if (result.success) {
      toast('Workflow dispatched! Publications will update in ~2 min.', 'success');
      status.textContent = `Dispatched at ${new Date().toLocaleTimeString()}`;
    } else {
      toast('Workflow dispatch returned status ' + result.status, 'error');
      status.textContent = 'Failed (status ' + result.status + ')';
    }
  } catch (err) {
    toast('Dispatch failed: ' + err.message, 'error');
    status.textContent = 'Error: ' + err.message;
  }

  btn.disabled = false;
  btn.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style="margin-right:0.4rem"><path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clip-rule="evenodd"/></svg>Sync Publications Now`;
}

async function loadPublicationsPreview() {
  const el = document.getElementById('pub-preview');
  try {
    const file = await githubGetFile('_data/publications.json');
    if (!file) { el.textContent = 'No publications data found.'; return; }
    const pubs = JSON.parse(decodeGithubContent(file.content));
    // Structure: { publications: [{ year, entries: [{ title, citation, venue, cited_by, url }] }] }
    const sections = pubs.publications || [];
    const allEntries = sections.flatMap(s => (s.entries || []).map(e => ({ ...e, year: s.year })));
    const recent = allEntries.slice(0, 5);
    if (!recent.length) { el.textContent = 'No publications found.'; return; }
    el.innerHTML = `<div style="font-size:0.78rem;color:var(--text2);margin-bottom:0.75rem">${allEntries.length} total · h-index ${pubs.h_index || '—'} · ${pubs.total_citations?.toLocaleString() || '—'} citations</div>` +
      recent.map(p => `
      <div style="padding:0.65rem 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:500;font-size:0.875rem;color:var(--text);line-height:1.4">
          ${p.url ? `<a href="${p.url}" target="_blank" style="color:inherit;text-decoration:none">${p.title}</a>` : p.title}
        </div>
        <div style="font-size:0.78rem;color:var(--text2);margin-top:0.2rem">
          ${p.citation ? p.citation.split(' - ')[0] : ''}
          ${p.venue ? `· <em>${p.venue}</em>` : ''}
          · ${p.year}
          ${p.cited_by ? `· cited ${p.cited_by}×` : ''}
        </div>
      </div>`).join('') +
      (allEntries.length > 5 ? `<div style="padding-top:0.65rem;color:var(--text2);font-size:0.8rem">… and ${allEntries.length - 5} more publications</div>` : '');
  } catch {
    el.textContent = 'Could not load publications preview.';
  }
}
