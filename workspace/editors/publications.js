import { edgeCall, githubGetFile, decodeGithubContent, toast, escapeHtml, safeUrl } from '../admin.js';
import { icon } from '../ui.js';

const WORKFLOW = 'update-publications.yml';
// Lucide refresh-ccw — clean continuous stroke (replaces the old fill-rule
// Heroicons "arrow-path" that read as broken pieces at button size).
const SYNC_ICON = `<span style="display:inline-flex;margin-right:0.4rem">${icon('sync')}</span>`;
const SPIN_ICON = `<span style="display:inline-flex;animation:spin 1s linear infinite">${icon('sync')}</span>`;

let pollTimer = null;
let activeRunId = null;

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
        The site will rebuild automatically (~1-2 min) after the workflow completes.
      </p>
      <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
        <button class="btn btn-accent" id="pub-sync-btn">${SYNC_ICON}Sync Publications Now</button>
        <button class="btn btn-danger btn-sm" id="pub-stop-btn" style="display:none">Stop Sync</button>
      </div>
      <div id="pub-sync-status" style="font-size:0.82rem;color:var(--text2);margin-top:0.75rem"></div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Recent Publications</span></div>
      <div id="pub-preview" style="color:var(--text2);font-size:0.82rem">Loading...</div>
    </div>
  `;

  document.getElementById('pub-sync-btn').addEventListener('click', syncPublications);
  document.getElementById('pub-stop-btn').addEventListener('click', stopSync);

  await Promise.all([loadPublicationsPreview(), checkWorkflowStatus()]);
}

function setStatus(html) {
  const el = document.getElementById('pub-sync-status');
  if (el) el.innerHTML = html;
}

function showRunning(runId) {
  activeRunId = runId;
  const btn = document.getElementById('pub-sync-btn');
  const stop = document.getElementById('pub-stop-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = SYNC_ICON + 'Syncing...'; }
  if (stop) stop.style.display = '';
  startPolling();
}

function showIdle() {
  activeRunId = null;
  const btn = document.getElementById('pub-sync-btn');
  const stop = document.getElementById('pub-stop-btn');
  if (btn) { btn.disabled = false; btn.innerHTML = SYNC_ICON + 'Sync Publications Now'; }
  if (stop) stop.style.display = 'none';
  stopPolling();
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(checkWorkflowStatus, 8000);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function checkWorkflowStatus() {
  try {
    const r = await edgeCall('github-proxy', { action: 'workflow_status', workflow: WORKFLOW });
    if (!r.run_id) { showIdle(); setStatus(''); return; }

    const time = r.updated_at ? new Date(r.updated_at).toLocaleString() : '';

    const safeTime = escapeHtml(time);
    const runHref = safeUrl(r.html_url);
    const runLink = runHref ? ` &middot; <a href="${runHref}" target="_blank" rel="noopener noreferrer" style="color:var(--text2)">View run</a>` : '';
    if (r.status === 'queued' || r.status === 'in_progress' || r.status === 'waiting') {
      showRunning(r.run_id);
      const label = r.status === 'queued' ? 'Queued' : r.status === 'waiting' ? 'Waiting' : 'Running';
      setStatus(`<span style="color:var(--accent)">${label}</span> &middot; ${safeTime}${runLink}`);
    } else {
      showIdle();
      const icon = r.conclusion === 'success' ? '&#10003;' : '&#10007;';
      const color = r.conclusion === 'success' ? '#22c55e' : '#ef4444';
      setStatus(`<span style="color:${color}">${icon} ${escapeHtml(r.conclusion || r.status)}</span> &middot; ${safeTime}${runLink}`);
    }
  } catch {
    // Silent fail on status check
  }
}

async function syncPublications() {
  const btn = document.getElementById('pub-sync-btn');
  btn.disabled = true;
  btn.innerHTML = SYNC_ICON + 'Dispatching...';
  setStatus('');

  try {
    const result = await edgeCall('github-proxy', { action: 'dispatch_workflow', workflow: WORKFLOW, ref: 'main' });
    if (result.success) {
      toast('Workflow dispatched! Polling for status...', 'success');
      setStatus('Dispatched, waiting for workflow to start...');
      // Give GitHub a moment to create the run, then start polling
      setTimeout(checkWorkflowStatus, 3000);
      startPolling();
    } else {
      toast('Dispatch returned status ' + result.status, 'error');
      setStatus('Failed (status ' + result.status + ')');
      showIdle();
    }
  } catch (err) {
    toast('Dispatch failed: ' + err.message, 'error');
    setStatus('Error: ' + err.message);
    showIdle();
  }
}

async function stopSync() {
  if (!activeRunId) return;
  const stop = document.getElementById('pub-stop-btn');
  stop.disabled = true; stop.textContent = 'Stopping...';

  try {
    const r = await edgeCall('github-proxy', { action: 'cancel_workflow', run_id: activeRunId });
    if (r.success) {
      toast('Workflow cancelled.', 'success');
      setStatus('Cancelled');
      showIdle();
    } else {
      toast('Cancel failed (status ' + r.status + ')', 'error');
      stop.disabled = false; stop.textContent = 'Stop Sync';
    }
  } catch (err) {
    toast('Cancel failed: ' + err.message, 'error');
    stop.disabled = false; stop.textContent = 'Stop Sync';
  }
}

async function loadPublicationsPreview() {
  const el = document.getElementById('pub-preview');
  try {
    const file = await githubGetFile('_data/publications.json');
    if (!file) { el.textContent = 'No publications data found.'; return; }
    const pubs = JSON.parse(decodeGithubContent(file.content));
    const sections = pubs.publications || [];
    const allEntries = sections.flatMap(s => (s.entries || []).map(e => ({ ...e, year: s.year })));
    const recent = allEntries.slice(0, 5);
    if (!recent.length) { el.textContent = 'No publications found.'; return; }
    el.innerHTML = `<div style="font-size:0.78rem;color:var(--text2);margin-bottom:0.75rem">${allEntries.length} total · h-index ${escapeHtml(pubs.h_index) || '\u2014'} · ${escapeHtml(pubs.total_citations?.toLocaleString()) || '\u2014'} citations</div>` +
      recent.map(p => `
      <div style="padding:0.65rem 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:500;font-size:0.875rem;color:var(--text);line-height:1.4">
          ${(() => { const href = safeUrl(p.url); const t = escapeHtml(p.title); return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none">${t}</a>` : t; })()}
        </div>
        <div style="font-size:0.78rem;color:var(--text2);margin-top:0.2rem">
          ${p.citation ? escapeHtml(p.citation.split(' - ')[0]) : ''}
          ${p.venue ? `· <em>${escapeHtml(p.venue)}</em>` : ''}
          · ${escapeHtml(p.year)}
          ${p.cited_by ? `· cited ${escapeHtml(p.cited_by)}×` : ''}
        </div>
      </div>`).join('') +
      (allEntries.length > 5 ? `<div style="padding-top:0.65rem;color:var(--text2);font-size:0.8rem">... and ${allEntries.length - 5} more publications</div>` : '');
  } catch {
    el.textContent = 'Could not load publications preview.';
  }
}
