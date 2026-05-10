import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const ROOT = resolve(__dirname, '..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

describe('_config.yml', () => {
  const raw = read('_config.yml');
  const cfg = yaml.load(raw);

  it('parses as YAML', () => {
    expect(cfg).toBeTruthy();
    expect(cfg.title).toBeTruthy();
  });

  it('uses /site as the baseurl (matches GitHub Pages subdir)', () => {
    expect(cfg.baseurl).toBe('/site');
  });

  it('does NOT list jekyll-spaceship (regression: not on GH Pages allowlist)', () => {
    expect(Array.isArray(cfg.plugins)).toBe(true);
    expect(cfg.plugins).not.toContain('jekyll-spaceship');
  });

  it('keeps test/dev artefacts out of the published site', () => {
    expect(cfg.exclude).toEqual(expect.arrayContaining([
      'tests/',
      'node_modules/',
      'package.json',
      'package-lock.json',
      'vitest.config.js',
    ]));
  });
});

describe('_layouts/default.html', () => {
  const html = read('_layouts/default.html');

  it('reveals the page on window.load', () => {
    expect(html).toMatch(/window\.addEventListener\(\s*['"]load['"]/);
  });

  it('has a hard timeout fallback so the overlay never traps the page', () => {
    expect(html).toMatch(/setTimeout\(\s*reveal/);
  });
});

describe('_includes/head.html', () => {
  const html = read('_includes/head.html');

  it('emits <meta name="base-url"> for shared client scripts', () => {
    expect(html).toMatch(/<meta\s+name="base-url"/);
  });

  it('still preloads the stylesheet via relative_url', () => {
    expect(html).toMatch(/'\/assets\/main\.css'\s*\|\s*relative_url/);
  });
});

describe('projects.md template', () => {
  const md = read('projects.md');

  it('falls back to project.title when image_alt is missing', () => {
    expect(md).toMatch(/project\.image_alt\s*\|\s*default:\s*project\.title/);
  });

  it('has a fallback for funding_alt too', () => {
    expect(md).toMatch(/project\.funding_alt\s*\|\s*default:/);
  });

  it('uses /images/sub/ (not assets/img/sub/) for project images', () => {
    expect(md).toMatch(/'\/images\/sub\/'/);
    expect(md).not.toMatch(/assets\/img\/sub/);
  });
});

describe('team & project layout images do not lazy-load', () => {
  // Images in the main layout must NOT have loading="lazy" — they need to
  // block window.load so the page-transition overlay clears at the right time.
  it('team.md does not set loading="lazy" on member cards', () => {
    if (!existsSync(resolve(ROOT, 'team.md'))) return;
    const md = read('team.md');
    // Allow lazy on background/decorative images, but not on .item-card-img / member photo.
    const memberImgBlocks = md.match(/<img[^>]*member[^>]*>/gi) || [];
    for (const img of memberImgBlocks) {
      expect(img, `lazy on member img: ${img}`).not.toMatch(/loading=["']lazy["']/);
    }
  });

  it('projects.md does not set loading="lazy"', () => {
    const md = read('projects.md');
    expect(md).not.toMatch(/loading=["']lazy["']/);
  });
});

describe('GitHub Actions workflow', () => {
  const workflowPath = resolve(ROOT, '.github/workflows/update-publications.yml');
  if (!existsSync(workflowPath)) return;
  const wf = yaml.load(readFileSync(workflowPath, 'utf8'));

  it('has a concurrency guard so simultaneous triggers do not race', () => {
    expect(wf.concurrency).toBeTruthy();
    expect(wf.concurrency.group).toBeTruthy();
    expect(wf.concurrency['cancel-in-progress']).toBe(true);
  });

  it('keeps permissions narrow', () => {
    expect(wf.permissions).toEqual({ contents: 'write' });
  });
});
