// ============================================================
// ANDA Lab Admin — Core JS
// ============================================================

export const SUPABASE_URL = 'https://xarrinotiwofnyzrmdow.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcnJpbm90aXdvZm55enJtZG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMzA4ODcsImV4cCI6MjA4ODYwNjg4N30.vc57Pod4pb_9QIcGIuuIDcdVgqjggcDIBXuapeeHDB4';
export const FUNCTIONS_URL = SUPABASE_URL + '/functions/v1';
export const BASE = document.querySelector('meta[name="base-url"]')?.content || '';

const { createClient } = supabase;
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Session ──────────────────────────────────────────────────
export let currentSession = null;
export let currentProfile = null;

export async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = BASE + '/workspace/login/'; return null; }

  const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (!profile || profile.status !== 'active') {
    await sb.auth.signOut();
    window.location.href = BASE + '/workspace/login/';
    return null;
  }
  currentSession = session;
  currentProfile = profile;
  return { session, profile };
}

export async function signOut() {
  await sb.auth.signOut();
  window.location.href = BASE + '/workspace/login/';
}

// ── GitHub Proxy ──────────────────────────────────────────────
async function getToken() {
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token;
}

export async function githubGetFile(path) {
  const token = await getToken();
  const res = await fetch(FUNCTIONS_URL + '/github-proxy', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_file', path })
  });
  if (res.status === 404) return null; // file doesn't exist yet
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch file');
  return data; // { content (base64), sha, ... }
}

export async function githubUpdateFile(path, contentStr, commitMsg) {
  const token = await getToken();
  const content = btoa(unescape(encodeURIComponent(contentStr)));
  const res = await fetch(FUNCTIONS_URL + '/github-proxy', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update_file', path, content, commit_message: commitMsg })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update file');
  return data;
}

export async function githubUploadImage(path, file) {
  const token = await getToken();
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  const content = btoa(binary);
  const res = await fetch(FUNCTIONS_URL + '/github-proxy', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update_file', path, content, commit_message: 'admin: upload image ' + path })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to upload image');
  return data;
}

export function decodeGithubContent(base64) {
  try {
    return decodeURIComponent(escape(atob(base64.replace(/\n/g, ''))));
  } catch {
    return atob(base64.replace(/\n/g, ''));
  }
}

// ── Edge Function calls ──────────────────────────────────────
export async function edgeCall(fn, body) {
  const token = await getToken();
  const res = await fetch(FUNCTIONS_URL + '/' + fn, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Toast ────────────────────────────────────────────────────
export function toast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = {
    success: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>',
    error: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/></svg>',
    info: '<svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clip-rule="evenodd"/></svg>',
  };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = (icons[type] || '') + message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ── Modal helpers ────────────────────────────────────────────
export function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}
export function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

// Close on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
  }
});
// Close on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
  }
});

// ── Tag input helper ─────────────────────────────────────────
export function initTagInput(container, initialValues = []) {
  container.innerHTML = '';
  const values = [...initialValues];

  function render() {
    container.innerHTML = '';
    values.forEach((v, i) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `${v}<button type="button" onclick="this.parentElement.remove()" data-i="${i}">&times;</button>`;
      tag.querySelector('button').addEventListener('click', () => {
        values.splice(i, 1);
        render();
      });
      container.appendChild(tag);
    });
    const input = document.createElement('input');
    input.placeholder = 'Add, press Enter…';
    input.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
        e.preventDefault();
        values.push(input.value.trim());
        render();
      }
      if (e.key === 'Backspace' && !input.value && values.length) {
        values.pop();
        render();
      }
    });
    container.appendChild(input);
  }

  render();
  return {
    getValues: () => [...values],
    setValues: (v) => { values.splice(0, values.length, ...v); render(); }
  };
}

// ── Image upload helper ──────────────────────────────────────
export function initImageUpload(area, preview, pathPrefix, onUploaded) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
  document.body.appendChild(input);

  area.addEventListener('click', () => input.click());
  area.addEventListener('dragover', (e) => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', async (e) => {
    e.preventDefault(); area.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  input.addEventListener('change', () => { if (input.files[0]) handleFile(input.files[0]); });

  async function handleFile(file) {
    // Preview immediately
    const reader = new FileReader();
    reader.onload = (e) => { if (preview) { preview.src = e.target.result; preview.style.display = 'block'; } };
    reader.readAsDataURL(file);

    const path = pathPrefix + '/' + file.name;
    try {
      area.style.opacity = '0.5';
      await githubUploadImage(path, file);
      area.style.opacity = '1';
      toast('Image uploaded', 'success');
      onUploaded(path, file.name);
    } catch (err) {
      area.style.opacity = '1';
      toast('Upload failed: ' + err.message, 'error');
    }
  }
}

// ── Theme toggle ─────────────────────────────────────────────
export function initThemeToggle(btn, onThemeChange) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    const curr = document.documentElement.getAttribute('data-theme');
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    onThemeChange?.(next);
  });
}

// ── i18n re-exports ──────────────────────────────────────────
export { t, setLocale, getLocale, applyI18n, initLangSwitcher, initCustomLangPicker } from './i18n.js';

// ── Confirm dialog ───────────────────────────────────────────
export function confirm(message) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';
    backdrop.style.zIndex = '9100';
    backdrop.innerHTML = `
      <div class="modal" style="width:340px">
        <div class="modal-header">
          <span class="modal-title">Confirm</span>
        </div>
        <div class="modal-body" style="padding:1.25rem 1.5rem">
          <p style="font-size:0.88rem">${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="confirm-cancel">Cancel</button>
          <button class="btn btn-danger" id="confirm-ok">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#confirm-cancel').addEventListener('click', () => { backdrop.remove(); resolve(false); });
    backdrop.querySelector('#confirm-ok').addEventListener('click', () => { backdrop.remove(); resolve(true); });
  });
}
