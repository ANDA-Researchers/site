import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { t, setLocale, getLocale } from '../workspace/i18n.js';

const SOURCE = readFileSync(resolve(__dirname, '../workspace/i18n.js'), 'utf8');

// Pull the per-locale key tables straight from the source by parsing the T object
// — running the file through eval is unsafe, but we just want the keys.
function extractKeysFor(locale) {
  const re = new RegExp(`${locale}:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm');
  const m = SOURCE.match(re);
  if (!m) throw new Error(`could not find locale block: ${locale}`);
  const block = m[1];
  // Match keys like `foo:` or `foo :` at the start of a token.
  const keys = new Set();
  for (const km of block.matchAll(/(?:^|[\s,])([a-zA-Z_][\w]*)\s*:/g)) {
    keys.add(km[1]);
  }
  return keys;
}

describe('i18n locale tables', () => {
  const en = extractKeysFor('en');
  const ko = extractKeysFor('ko');
  const vi = extractKeysFor('vi');

  it('all three locales expose the same set of keys', () => {
    const missingFromKo = [...en].filter(k => !ko.has(k));
    const missingFromVi = [...en].filter(k => !vi.has(k));
    const extraInKo = [...ko].filter(k => !en.has(k));
    const extraInVi = [...vi].filter(k => !en.has(k));
    expect({ missingFromKo, missingFromVi, extraInKo, extraInVi }).toEqual({
      missingFromKo: [],
      missingFromVi: [],
      extraInKo: [],
      extraInVi: [],
    });
  });

  it('has no duplicate key declarations within a locale block', () => {
    for (const locale of ['en', 'ko', 'vi']) {
      const re = new RegExp(`${locale}:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm');
      const block = SOURCE.match(re)[1];
      const seen = new Map();
      for (const km of block.matchAll(/(?:^|[\s,])([a-zA-Z_][\w]*)\s*:/g)) {
        seen.set(km[1], (seen.get(km[1]) || 0) + 1);
      }
      const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
      expect(dupes, `duplicate keys in locale "${locale}"`).toEqual([]);
    }
  });

  it('exposes invite_title in every locale (regression: was missing)', () => {
    expect(en.has('invite_title')).toBe(true);
    expect(ko.has('invite_title')).toBe(true);
    expect(vi.has('invite_title')).toBe(true);
  });

  it('login_backend_unavailable copy no longer references "Supabase project URL"', () => {
    // The original copy implied users could fix it themselves; new copy is generic.
    expect(SOURCE).not.toMatch(/Update the Supabase project URL/);
  });
});

describe('i18n runtime', () => {
  it('falls back to English for unknown locales / missing keys', () => {
    setLocale('en');
    const before = t('login_btn');
    setLocale('zz');
    expect(t('login_btn')).toBe(before);
    expect(t('definitely_missing_key')).toBe('definitely_missing_key');
    setLocale('en');
  });

  it('persists the active locale via getLocale', () => {
    setLocale('ko');
    expect(getLocale()).toBe('ko');
    setLocale('en');
  });
});
