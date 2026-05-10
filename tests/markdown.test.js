import { describe, it, expect } from 'vitest';
import { mdToHtml } from '../workspace/editors/pages.js';

describe('mdToHtml', () => {
  it('renders headings', () => {
    expect(mdToHtml('# Title')).toContain('<h1>Title</h1>');
    expect(mdToHtml('## Sub')).toContain('<h2>Sub</h2>');
    expect(mdToHtml('###### Deep')).toContain('<h6>Deep</h6>');
  });

  it('renders bold/italic/code', () => {
    expect(mdToHtml('**bold**')).toContain('<strong>bold</strong>');
    expect(mdToHtml('*em*')).toContain('<em>em</em>');
    expect(mdToHtml('`code`')).toContain('<code>code</code>');
  });

  it('escapes raw HTML', () => {
    const out = mdToHtml('<script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('strips javascript: from links and falls back to text', () => {
    const out = mdToHtml('[click](javascript:alert(1))');
    expect(out).not.toContain('javascript:');
    expect(out).not.toMatch(/<a\s/);
    expect(out).toContain('click');
  });

  it('renders safe http links with rel/target', () => {
    const out = mdToHtml('[ANDA](https://anda.example)');
    expect(out).toContain('href="https://anda.example"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('strips Jekyll front matter', () => {
    const md = '---\ntitle: Foo\n---\n# Hello';
    expect(mdToHtml(md)).toContain('<h1>Hello</h1>');
    expect(mdToHtml(md)).not.toContain('title: Foo');
  });

  it('renders a list', () => {
    const out = mdToHtml('- one\n- two');
    expect(out).toContain('<ul>');
    expect(out).toContain('<li>one</li>');
  });

  it('handles null/undefined input', () => {
    expect(() => mdToHtml(null)).not.toThrow();
    expect(() => mdToHtml(undefined)).not.toThrow();
  });
});
