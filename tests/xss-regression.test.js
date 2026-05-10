import { describe, it, expect, beforeEach } from 'vitest';
import { escapeHtml, safeUrl } from '../workspace/admin.js';

// These tests exercise the patterns the editors use when rendering untrusted
// JSON into innerHTML, and prove that hostile data does not produce a <script>
// element or an attribute with a javascript: URL after escaping.

const NASTY = `<img src=x onerror=alert(1)><script>alert(1)</script>"><svg onload=alert(1)>`;

describe('XSS regression — editor render patterns', () => {
  let host;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('team card name (escaped) yields no executable elements', () => {
    const m = { name: NASTY, role: NASTY };
    host.innerHTML = `
      <div class="item-card-name">${escapeHtml(m.name) || '—'}</div>
      <div class="item-card-role">${escapeHtml(m.role) || ''}</div>`;
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('img[src="x"]')).toBeNull();
    expect(host.querySelector('svg[onload]')).toBeNull();
  });

  it('alumni link is dropped if scheme is unsafe', () => {
    const a = { name: NASTY, link: 'javascript:alert(1)' };
    const safeLink = safeUrl(a.link);
    const safeName = escapeHtml(a.name);
    host.innerHTML = `
      <div>${safeLink ? `<a href="${safeLink}">${safeName}</a>` : safeName}</div>`;
    expect(host.querySelector('a')).toBeNull();
    expect(host.querySelector('script')).toBeNull();
  });

  it('publications href filters javascript:', () => {
    const p = { title: NASTY, url: 'javascript:alert(1)' };
    const href = safeUrl(p.url);
    const titleHtml = href
      ? `<a href="${href}">${escapeHtml(p.title)}</a>`
      : escapeHtml(p.title);
    host.innerHTML = titleHtml;
    expect(host.querySelector('a')).toBeNull();
    expect(host.querySelector('script')).toBeNull();
  });

  it('config field render escapes embedded quotes inside value attribute', () => {
    const val = `" autofocus onfocus="alert(1)`;
    host.innerHTML = `<input type="text" value="${escapeHtml(val)}">`;
    const input = host.querySelector('input');
    expect(input).not.toBeNull();
    expect(input.hasAttribute('autofocus')).toBe(false);
    expect(input.hasAttribute('onfocus')).toBe(false);
  });

  it('users-table row escapes email and id (no breakout from data attributes)', () => {
    const p = { id: `'); evil('`, email: `x"></td><script>alert(1)</script>` };
    host.innerHTML = `
      <button data-action="approve" data-id="${escapeHtml(p.id)}">Approve</button>
      <td>${escapeHtml(p.email)}</td>`;
    const btn = host.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn.dataset.id).toBe(p.id);
    expect(host.querySelector('script')).toBeNull();
  });

  it('image src built with encodeURIComponent does not break out of the attribute', () => {
    const filename = `photo".png onload="alert(1)`;
    const src = `/site/images/${encodeURIComponent(filename)}`;
    host.innerHTML = `<img src="${src}">`;
    const img = host.querySelector('img');
    expect(img).not.toBeNull();
    expect(img.hasAttribute('onload')).toBe(false);
    // Round-tripping must yield the original filename.
    const decoded = decodeURIComponent(img.getAttribute('src').replace('/site/images/', ''));
    expect(decoded).toBe(filename);
  });
});

describe('XSS regression — confirm() dialog', () => {
  let confirmFn;
  beforeEach(async () => {
    document.body.innerHTML = '';
    const mod = await import('../workspace/admin.js');
    confirmFn = mod.confirm;
  });

  it('renders the message as text, never as HTML', () => {
    // Don't await — we just want to inspect the DOM the dialog appends.
    const promise = confirmFn(NASTY);
    const dialog = document.querySelector('.modal-backdrop');
    expect(dialog).not.toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(document.querySelector('svg[onload]')).toBeNull();
    const messageEl = dialog.querySelector('.confirm-message');
    expect(messageEl.textContent).toContain('<script');
    // Resolve it so tests don't leak open dialogs
    dialog.querySelector('#confirm-cancel').click();
    return promise;
  });

  it('uses the i18n key for the OK button label by default', () => {
    const promise = confirmFn('Are you sure?');
    const dialog = document.querySelector('.modal-backdrop');
    const ok = dialog.querySelector('#confirm-ok');
    // Default confirmKey is 'btn_delete' → 'Delete' in en.
    expect(ok.textContent).toBe('Delete');
    dialog.querySelector('#confirm-cancel').click();
    return promise;
  });

  it('respects the confirmKey override', () => {
    const promise = confirmFn('Discard?', { confirmKey: 'btn_discard', variant: 'ghost' });
    const dialog = document.querySelector('.modal-backdrop');
    expect(dialog.querySelector('#confirm-ok').textContent).toBe('Discard');
    expect(dialog.querySelector('#confirm-ok').classList.contains('btn-ghost')).toBe(true);
    dialog.querySelector('#confirm-cancel').click();
    return promise;
  });
});

describe('XSS regression — initTagInput', () => {
  it('escapes tag values on render', async () => {
    const { initTagInput } = await import('../workspace/admin.js');
    const container = document.createElement('div');
    document.body.appendChild(container);
    initTagInput(container, [NASTY, '<svg onload=alert(1)>']);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.querySelector('svg[onload]')).toBeNull();
    // The first tag chip should still show the raw text content.
    const firstTag = container.querySelector('.tag');
    expect(firstTag.textContent).toContain('<img');
  });
});

describe('XSS regression — toast', () => {
  it('escapes the message text', async () => {
    document.body.innerHTML = '<div id="toast-container"></div>';
    const { toast } = await import('../workspace/admin.js');
    toast(NASTY, 'error');
    const toastEl = document.querySelector('.toast');
    expect(toastEl).not.toBeNull();
    expect(document.querySelector('.toast script')).toBeNull();
    expect(document.querySelector('.toast img[onerror]')).toBeNull();
    expect(toastEl.textContent).toContain('<img');
  });
});
