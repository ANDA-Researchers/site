import { describe, it, expect } from 'vitest';
import { escapeHtml, safeUrl, sanitizeFilename } from '../workspace/admin.js';

describe('escapeHtml', () => {
  it('escapes the five HTML metacharacters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml('"quote"')).toBe('&quot;quote&quot;');
    expect(escapeHtml("'apos'")).toBe('&#39;apos&#39;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('treats null/undefined as empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces non-strings', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(false)).toBe('false');
  });

  it('produces output that renders as text (not HTML) in the DOM', () => {
    const once = escapeHtml('<a>');
    const div = document.createElement('div');
    div.innerHTML = once;
    // The escaped form, set as innerHTML, must yield no <a> element — only text.
    expect(div.querySelector('a')).toBeNull();
    expect(div.textContent).toBe('<a>');
  });
});

describe('safeUrl', () => {
  it('passes through http and https', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com');
    expect(safeUrl('http://example.com/x?a=1&b=2')).toBe('http://example.com/x?a=1&amp;b=2');
  });

  it('passes through mailto and tel', () => {
    expect(safeUrl('mailto:x@y.z')).toBe('mailto:x@y.z');
    expect(safeUrl('tel:+82-2-820-0114')).toBe('tel:+82-2-820-0114');
  });

  it('passes through root-relative, fragment, and query', () => {
    expect(safeUrl('/site/about/')).toBe('/site/about/');
    expect(safeUrl('#anchor')).toBe('#anchor');
    expect(safeUrl('?q=1')).toBe('?q=1');
  });

  it('rejects javascript: in any case or with whitespace', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('JavaScript:alert(1)')).toBe('');
    expect(safeUrl('  javascript:alert(1)')).toBe('');
    expect(safeUrl('JAVASCRIPT:alert(1)')).toBe('');
  });

  it('rejects data:, vbscript:, file:', () => {
    expect(safeUrl('data:text/html,<script>1</script>')).toBe('');
    expect(safeUrl('vbscript:msgbox')).toBe('');
    expect(safeUrl('file:///etc/passwd')).toBe('');
  });

  it('treats relative paths as safe', () => {
    expect(safeUrl('about/')).toBe('about/');
    expect(safeUrl('../parent')).toBe('../parent');
  });

  it('handles null/undefined/empty', () => {
    expect(safeUrl(null)).toBe('');
    expect(safeUrl(undefined)).toBe('');
    expect(safeUrl('')).toBe('');
    expect(safeUrl('   ')).toBe('');
  });

  it('escapes HTML metachars in the URL', () => {
    expect(safeUrl('https://x?q=<script>')).toContain('&lt;script&gt;');
  });
});

describe('sanitizeFilename', () => {
  it('strips path separators and collapses dot-runs so .. cannot survive', () => {
    const r1 = sanitizeFilename('../../etc/passwd');
    expect(r1).not.toContain('..');
    expect(r1).not.toContain('/');
    expect(r1.startsWith('.')).toBe(false);
    expect(sanitizeFilename('a\\b\\c.png')).toBe('a_b_c.png');
    expect(sanitizeFilename('a/b/c.png')).toBe('a_b_c.png');
  });

  it('strips control chars and spaces', () => {
    expect(sanitizeFilename('foo bar.png')).toBe('foo_bar.png');
    expect(sanitizeFilename('foo\nbar.png')).toBe('foo_bar.png');
  });

  it('keeps safe characters including a single dot for the extension', () => {
    expect(sanitizeFilename('photo-2026.01_v2.webp')).toBe('photo-2026.01_v2.webp');
  });

  it('refuses to start with a dot/underscore/dash (no dotfiles)', () => {
    expect(sanitizeFilename('.htaccess.png')).not.toMatch(/^\./);
    expect(sanitizeFilename('-rf.png')).not.toMatch(/^-/);
    expect(sanitizeFilename('_internal.png')).not.toMatch(/^_/);
  });

  it('caps length', () => {
    const long = 'a'.repeat(500);
    expect(sanitizeFilename(long).length).toBe(200);
  });
});
