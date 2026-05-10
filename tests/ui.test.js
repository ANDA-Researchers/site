import { describe, it, expect, beforeEach } from 'vitest';
import {
  card,
  field,
  sectionHeader,
  publishBar,
  emptyState,
  attrs,
  icon,
  imageSrc,
} from '../workspace/ui.js';
import { applyI18n, setLocale } from '../workspace/i18n.js';

const NASTY = `<img src=x onerror=alert(1)><script>alert(1)</script>"><svg onload=alert(1)>`;

function mount(html) {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

describe('ui.attrs', () => {
  it('serializes attributes safely', () => {
    expect(attrs({ id: 'a', 'data-x': 'b' })).toBe(' id="a" data-x="b"');
  });
  it('emits boolean true as bare attribute', () => {
    expect(attrs({ disabled: true })).toBe(' disabled');
  });
  it('skips false / null / undefined', () => {
    expect(attrs({ a: false, b: null, c: undefined, d: 0 })).toBe(' d="0"');
  });
  it('escapes attribute values', () => {
    expect(attrs({ id: '"><script>' })).toContain('&quot;');
    expect(attrs({ id: '"><script>' })).not.toContain('<script>');
  });
  it('rejects attribute names with weird characters', () => {
    expect(attrs({ 'on click': 'evil' })).toBe('');
    expect(attrs({ '<bad>': 'evil' })).toBe('');
  });
  it('returns empty string for null/undefined', () => {
    expect(attrs(null)).toBe('');
    expect(attrs(undefined)).toBe('');
  });
});

describe('ui.card', () => {
  let host;
  beforeEach(() => { host = null; });

  it('renders the title text-content (escaped)', () => {
    host = mount(card({ title: NASTY, variant: 'grid' }));
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('img[onerror]')).toBeNull();
    expect(host.querySelector('.card-title').textContent).toContain('<img');
  });

  it('escapes subtitle and meta', () => {
    host = mount(card({ title: 'OK', subtitle: NASTY, meta: NASTY, variant: 'grid' }));
    expect(host.querySelector('script')).toBeNull();
  });

  it('treats actions as caller-trusted HTML', () => {
    host = mount(card({ title: 'OK', actions: '<button data-action="edit">E</button>', variant: 'grid' }));
    expect(host.querySelector('button[data-action="edit"]')).not.toBeNull();
  });

  it('emits a placeholder for the avatar variant when no image given', () => {
    host = mount(card({ title: 'No image', variant: 'grid' }));
    expect(host.querySelector('.card-image--placeholder')).not.toBeNull();
  });

  it('escapes alt text and rejects unsafe image src', () => {
    host = mount(card({
      title: 'X',
      image: { src: 'javascript:alert(1)', alt: NASTY },
      variant: 'media',
    }));
    const img = host.querySelector('img.card-image');
    // safeUrl returns '' for javascript: → src is empty string, not the payload
    expect(img.getAttribute('src')).toBe('');
    // The alt value will round-trip with entity decoding when read back
    // (that's correct; the HTML attribute string itself is escaped).
    // What matters is that no <svg> / <script> element actually got created.
    expect(host.querySelector('svg[onload]')).toBeNull();
    expect(host.querySelector('script')).toBeNull();
  });

  it('serializes dataset entries as data-* attributes', () => {
    host = mount(card({ title: 'X', dataset: { si: 0, mi: 2 }, variant: 'grid' }));
    const article = host.querySelector('article');
    expect(article.dataset.si).toBe('0');
    expect(article.dataset.mi).toBe('2');
  });
});

describe('ui.field', () => {
  it('emits data-i18n on the label so applyI18n drives the text', () => {
    const host = mount(field({ id: 'f1', labelKey: 'f_name', labelFallback: 'Name' }));
    const label = host.querySelector('label');
    expect(label.dataset.i18n).toBe('f_name');
    expect(label.textContent).toBe('Name');
  });

  it('survives a locale switch (label gets retranslated)', () => {
    const host = mount(field({ id: 'f1', labelKey: 'f_name', labelFallback: 'Name' }));
    document.body.appendChild(host);
    setLocale('ko');
    applyI18n();
    const label = host.querySelector('label');
    expect(label.textContent).toBe('이름');
    setLocale('en');
    applyI18n();
    expect(label.textContent).toBe('Name');
  });

  it('escapes the value in input attributes', () => {
    const host = mount(field({ id: 'f1', labelKey: 'f_name', value: NASTY }));
    const input = host.querySelector('input');
    expect(input.value).toBe(NASTY);          // round-trips
    expect(host.querySelector('script')).toBeNull();
  });

  it('renders a textarea with the value escaped', () => {
    const host = mount(field({ id: 'bio', labelKey: 'f_bio', type: 'textarea', value: NASTY }));
    const ta = host.querySelector('textarea');
    expect(ta.value).toBe(NASTY);
    expect(host.querySelector('script')).toBeNull();
  });

  it('renders a select with options', () => {
    const html = field({
      id: 'status',
      labelKey: 'f_status',
      type: 'select',
      value: 'Ongoing',
      options: [
        { value: 'Ongoing', labelFallback: 'Ongoing' },
        { value: 'Ended', labelFallback: 'Ended' },
      ],
    });
    const host = mount(html);
    const select = host.querySelector('select');
    expect(select.value).toBe('Ongoing');
    expect(select.querySelectorAll('option').length).toBe(2);
  });
});

describe('ui.sectionHeader', () => {
  it('emits data-i18n on title and description', () => {
    const host = mount(sectionHeader({
      titleKey: 'team_title',
      titleFallback: 'Team Members',
      descKey: 'team_desc',
      descFallback: 'Manage lab members',
    }));
    expect(host.querySelector('h2').dataset.i18n).toBe('team_title');
    expect(host.querySelector('p').dataset.i18n).toBe('team_desc');
  });

  it('omits the description when no key/fallback given', () => {
    const host = mount(sectionHeader({ titleFallback: 'Just a title' }));
    expect(host.querySelector('p')).toBeNull();
  });

  it('renders actions slot HTML verbatim (caller-trusted)', () => {
    const host = mount(sectionHeader({
      titleFallback: 'X',
      actions: '<button data-action="refresh">R</button>',
    }));
    expect(host.querySelector('button[data-action="refresh"]')).not.toBeNull();
  });
});

describe('ui.publishBar', () => {
  it('uses the supplied btnId and is initially disabled', () => {
    const host = mount(publishBar({ btnId: 'team-publish' }));
    const btn = host.querySelector('#team-publish');
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
  });

  it('escapes the btnId so it cannot break out of the attribute', () => {
    const host = mount(publishBar({ btnId: 'a"><script>' }));
    expect(host.querySelector('script')).toBeNull();
  });
});

describe('ui.emptyState', () => {
  it('renders a paragraph with data-i18n when messageKey supplied', () => {
    const host = mount(emptyState({ messageKey: 'no_changes', messageFallback: 'No changes' }));
    expect(host.querySelector('p').dataset.i18n).toBe('no_changes');
  });
});

describe('ui.icon', () => {
  it('returns the requested SVG', () => {
    expect(icon('edit')).toMatch(/^<svg/);
    expect(icon('publish')).toMatch(/^<svg/);
    expect(icon('grip')).toMatch(/^<svg/);
  });
  it('returns a fallback for unknown names without throwing', () => {
    expect(icon('nonexistent')).toMatch(/^<svg/);
  });
});

describe('ui.imageSrc', () => {
  it('encodes the filename', () => {
    expect(imageSrc('images', 'a b/c.png')).toBe('/site/images/a%20b%2Fc.png');
  });
  it('returns empty string for empty filename', () => {
    expect(imageSrc('images', '')).toBe('');
    expect(imageSrc('images', null)).toBe('');
  });
});
