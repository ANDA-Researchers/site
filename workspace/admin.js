// ============================================================
// ANDA Lab Admin — Core JS
// ============================================================

import {
  IS_DEV_MODE,
  makeMockSupabaseClient,
  mockGithubGetFile,
  mockGithubUpdateFile,
  mockGithubUploadImage,
  mockEdgeCall,
  injectDevBanner,
} from './dev/mock.js';

export { IS_DEV_MODE } from './dev/mock.js';

export const SUPABASE_URL = 'https://xarrinotiwofnyzrmdow.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcnJpbm90aXdvZm55enJtZG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMzA4ODcsImV4cCI6MjA4ODYwNjg4N30.vc57Pod4pb_9QIcGIuuIDcdVgqjggcDIBXuapeeHDB4';
export const FUNCTIONS_URL = SUPABASE_URL + '/functions/v1';
export const BASE = document.querySelector('meta[name="base-url"]')?.content || '';

if (IS_DEV_MODE) {
  // Run after DOM ready so the banner has a body to attach to.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDevBanner, { once: true });
  } else {
    injectDevBanner();
  }
}

const { createClient } = supabase;
export let sb = null;
let backendReachablePromise = null;

function workspaceLoginUrl(reason = '') {
  const url = new URL(BASE + '/workspace/login/', window.location.origin);
  if (reason) url.searchParams.set('error', reason);
  return url.pathname + url.search + url.hash;
}

function clearStoredSupabaseSession() {
  const stores = [window.localStorage, window.sessionStorage];
  const markers = ['supabase.auth.token', 'sb-', 'xarrinotiwofnyzrmdow'];
  for (const store of stores) {
    try {
      const keys = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key && markers.some(marker => key.includes(marker))) keys.push(key);
      }
      keys.forEach(key => store.removeItem(key));
    } catch {}
  }
}

export function isFetchResolutionError(error) {
  const message = String(error?.message || error || '');
  return message.includes('Failed to fetch')
    || message.includes('ERR_NAME_NOT_RESOLVED')
    || message.includes('Load failed')
    || message.includes('NetworkError');
}

async function checkSupabaseReachable() {
  if (!backendReachablePromise) {
    backendReachablePromise = (async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      try {
        const res = await fetch(SUPABASE_URL + '/auth/v1/health', {
          method: 'GET',
          cache: 'no-store',
          headers: { apikey: SUPABASE_ANON_KEY },
          signal: ctrl.signal,
        });
        return res.ok || res.status === 404 || res.status === 401;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    })();
  }
  return backendReachablePromise;
}

export function resetBackendReachableCache() {
  backendReachablePromise = null;
}

async function ensureSupabase() {
  if (sb) return sb;
  if (IS_DEV_MODE) {
    sb = makeMockSupabaseClient();
    return sb;
  }
  const reachable = await checkSupabaseReachable();
  if (!reachable) {
    clearStoredSupabaseSession();
    return null;
  }
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  return sb;
}

// ── Session ──────────────────────────────────────────────────
export let currentSession = null;
export let currentProfile = null;

export async function requireAuth() {
  const client = await ensureSupabase();
  if (!client) {
    window.location.href = workspaceLoginUrl('backend_unreachable');
    return null;
  }

  let session = null;
  try {
    ({ data: { session } } = await client.auth.getSession());
  } catch (error) {
    if (isFetchResolutionError(error)) {
      clearStoredSupabaseSession();
      window.location.href = workspaceLoginUrl('backend_unreachable');
      return null;
    }
    throw error;
  }
  if (!session) {
    window.location.href = workspaceLoginUrl();
    return null;
  }

  const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', session.user.id).single();
  if (profileError && isFetchResolutionError(profileError)) {
    clearStoredSupabaseSession();
    window.location.href = workspaceLoginUrl('backend_unreachable');
    return null;
  }
  if (!profile || profile.status !== 'active') {
    try {
      await client.auth.signOut();
    } catch {}
    window.location.href = workspaceLoginUrl();
    return null;
  }
  currentSession = session;
  currentProfile = profile;
  return { session, profile };
}

export async function signOut() {
  const client = await ensureSupabase();
  try {
    if (client) await client.auth.signOut();
  } catch {}
  clearStoredSupabaseSession();
  window.location.href = workspaceLoginUrl();
}

// ── GitHub Proxy ──────────────────────────────────────────────
async function getToken() {
  const client = await ensureSupabase();
  if (!client) {
    const err = new Error('Workspace backend is unavailable.');
    err.backendUnavailable = true;
    throw err;
  }
  const { data: { session } } = await client.auth.getSession();
  return session?.access_token;
}

export async function githubGetFile(path) {
  if (IS_DEV_MODE) return mockGithubGetFile(path);
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

export async function githubUpdateFile(path, contentStr, commitMsg, sha) {
  if (IS_DEV_MODE) return mockGithubUpdateFile(path, contentStr, commitMsg, sha);
  const token = await getToken();
  const content = btoa(unescape(encodeURIComponent(contentStr)));
  const body = { action: 'update_file', path, content, commit_message: commitMsg };
  if (sha) body.sha = sha;
  const res = await fetch(FUNCTIONS_URL + '/github-proxy', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update file');
  return data;
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export async function githubUploadImage(path, file) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }
  if (IS_DEV_MODE) return mockGithubUploadImage(path, file);
  const token = await getToken();
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  const content = btoa(binary);
  // Path is admin-controlled (built from a known prefix + sanitized filename), but commit_message
  // takes the raw path which may contain newlines on hostile systems — strip control chars.
  const safePath = path.replace(/[\r\n\x00-\x1f]/g, '');
  const res = await fetch(FUNCTIONS_URL + '/github-proxy', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update_file', path: safePath, content, commit_message: 'admin: upload image ' + safePath })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to upload image');
  return data;
}

// ── HTML / URL safety helpers ────────────────────────────────
const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch]);
}

const SAFE_URL_SCHEMES = /^(?:https?:|mailto:|tel:|\/|#|\?)/i;
export function safeUrl(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';
  // Allow protocol-relative, root-relative, fragment, and the explicitly safe schemes.
  if (SAFE_URL_SCHEMES.test(str)) return escapeHtml(str);
  // Reject javascript:, data:, vbscript:, file:, etc.
  if (/^[a-z][a-z0-9+.\-]*:/i.test(str)) return '';
  // Anything else (relative path) we treat as safe but still escape.
  return escapeHtml(str);
}

export function sanitizeFilename(name) {
  return String(name || '')
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    .replace(/\.{2,}/g, '_')   // collapse runs of dots so ".." can't survive
    .replace(/^[._-]+/, '')     // never start with a dot/underscore/dash
    .slice(0, 200);
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
  if (IS_DEV_MODE) return mockEdgeCall(fn, body);
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
  // Lucide circle-check / circle-x / info icons (verbatim).
  const ico = (path) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const icons = {
    success: ico('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
    error: ico('<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'),
    info: ico('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  // Icon HTML is a trusted constant; the message string may contain
  // exception text from anywhere — escape it.
  el.innerHTML = (icons[type] || '') + escapeHtml(message);
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}

// ── Modal helpers ────────────────────────────────────────────
// Stack of open modals so a confirm() over an editor modal nests cleanly.
const openModalStack = [];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function trappedKeydown(event) {
  if (event.key !== 'Tab') return;
  const top = openModalStack[openModalStack.length - 1];
  if (!top) return;
  // Focus trap is scoped to the modal element only — not document-wide —
  // so the dev banner and other ambient UI stay out of the cycle.
  const root = top.element.querySelector('.modal') || top.element;
  const focusable = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(el => el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    last.focus();
    event.preventDefault();
  } else if (!event.shiftKey && document.activeElement === last) {
    first.focus();
    event.preventDefault();
  }
}

function pushModal(element) {
  const previouslyFocused = document.activeElement;
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  openModalStack.push({ element, previouslyFocused });
  // Focus the first focusable inside the modal so keyboard users land there.
  const root = element.querySelector('.modal') || element;
  const focusable = root.querySelector(FOCUSABLE_SELECTOR);
  if (focusable) focusable.focus();
}

function popModal(element) {
  const idx = openModalStack.findIndex(entry => entry.element === element);
  if (idx === -1) return;
  const [{ previouslyFocused }] = openModalStack.splice(idx, 1);
  if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
    previouslyFocused.focus();
  }
}

export function openModal(id) {
  const m = typeof id === 'string' ? document.getElementById(id) : id;
  if (!m) return;
  m.classList.add('open');
  pushModal(m);
}
export function closeModal(id) {
  const m = typeof id === 'string' ? document.getElementById(id) : id;
  if (!m) return;
  m.classList.remove('open');
  popModal(m);
}

document.addEventListener('keydown', trappedKeydown);

// Close on backdrop click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop') && e.target.classList.contains('open')) {
    closeModal(e.target);
  }
});
// Close on Escape — dismiss only the topmost modal.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const top = openModalStack[openModalStack.length - 1];
  if (top) closeModal(top.element);
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
      // Escape the tag value — it's user-controlled (research areas, project reps, etc.)
      tag.innerHTML = `${escapeHtml(v)}<button type="button" data-i="${i}" aria-label="Remove">&times;</button>`;
      tag.querySelector('button').addEventListener('click', () => {
        values.splice(i, 1);
        render();
      });
      container.appendChild(tag);
    });
    const input = document.createElement('input');
    input.placeholder = t('tag_ph') || 'Add, press Enter…';
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

// ── i18n ─────────────────────────────────────────────────────
// Imported AND re-exported so internal functions (toast, confirm, tag input)
// can call t() directly without forcing every editor to grab it separately.
import { t, setLocale, getLocale, applyI18n, initLangSwitcher, initCustomLangPicker } from './i18n.js';
export { t, setLocale, getLocale, applyI18n, initLangSwitcher, initCustomLangPicker };

// ── Confirm dialog ───────────────────────────────────────────
//   confirm("Remove user X?")
//   confirm("Discard changes?", { confirmKey: 'btn_discard', variant: 'ghost' })
// `message` is escape-by-default. `confirmKey` is an i18n key for the OK
// button label; `confirmLabel` overrides that with a literal string.
// `variant` selects the OK button class — 'danger' (default), 'accent',
// or 'ghost'.
export function confirm(message, opts = {}) {
  const {
    confirmKey = 'btn_delete',
    confirmLabel,
    variant = 'danger',
    titleKey = 'confirm_title',
  } = opts;
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';
    backdrop.style.zIndex = '9100';
    const okLabel = confirmLabel ?? t(confirmKey);
    const cancelLabel = t('btn_cancel');
    const titleLabel = t(titleKey);
    const okClass = variant === 'accent' ? 'btn-accent'
      : variant === 'ghost' ? 'btn-ghost'
      : 'btn-danger';
    backdrop.innerHTML = `
      <div class="modal modal--confirm">
        <div class="modal-header">
          <span class="modal-title">${escapeHtml(titleLabel)}</span>
        </div>
        <div class="modal-body modal-body--confirm">
          <p class="confirm-message">${escapeHtml(message)}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="confirm-cancel">${escapeHtml(cancelLabel)}</button>
          <button class="btn ${okClass}" id="confirm-ok">${escapeHtml(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    pushModal(backdrop);
    const cleanup = (result) => { popModal(backdrop); backdrop.remove(); resolve(result); };
    backdrop.querySelector('#confirm-cancel').addEventListener('click', () => cleanup(false));
    backdrop.querySelector('#confirm-ok').addEventListener('click', () => cleanup(true));
  });
}
