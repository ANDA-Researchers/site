import { describe, it, expect } from 'vitest';
import { getYamlValue, setYamlValue } from '../workspace/editors/config.js';

const SAMPLE = `title: ANDA Lab
baseurl: /site
description: Multi-word value here
email: x@y.z

plugins:
  - jekyll-seo-tag
`;

describe('getYamlValue', () => {
  it('reads top-level scalar values', () => {
    expect(getYamlValue(SAMPLE, 'title')).toBe('ANDA Lab');
    expect(getYamlValue(SAMPLE, 'baseurl')).toBe('/site');
    expect(getYamlValue(SAMPLE, 'email')).toBe('x@y.z');
  });

  it('strips wrapping quotes', () => {
    const yaml = `title: "Quoted"\nfoo: 'single'`;
    expect(getYamlValue(yaml, 'title')).toBe('Quoted');
    expect(getYamlValue(yaml, 'foo')).toBe('single');
  });

  it('returns empty string for missing keys', () => {
    expect(getYamlValue(SAMPLE, 'missing')).toBe('');
  });
});

describe('setYamlValue', () => {
  it('updates an existing key in place', () => {
    const out = setYamlValue(SAMPLE, 'title', 'New Lab');
    expect(out).toContain('title: New Lab');
    expect(out).not.toContain('title: ANDA Lab');
    // Other keys preserved.
    expect(out).toContain('baseurl: /site');
  });

  it('appends a new key when missing', () => {
    const out = setYamlValue(SAMPLE, 'newkey', 'newval');
    expect(out).toContain('newkey: newval');
  });

  it('quotes multi-line values and escapes embedded quotes', () => {
    const out = setYamlValue('title: x\n', 'title', 'line1\nline2');
    expect(out).toContain('title: "line1\\nline2"');
  });

  it('round-trips a get→set cycle', () => {
    const out = setYamlValue(SAMPLE, 'title', getYamlValue(SAMPLE, 'title'));
    expect(getYamlValue(out, 'title')).toBe('ANDA Lab');
  });
});
