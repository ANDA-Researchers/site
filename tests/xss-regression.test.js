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
