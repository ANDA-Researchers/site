import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The Edge Function ships its allowlist as TypeScript and runs on Deno.
// We mirror the regex set here and assert the source still contains the
// expected anchors so a later edit can't silently widen the allowlist.
const ALLOWED_PATHS = [
  /^_data\/(team|projects|publications|lablife)\.json$/,
  /^_config\.yml$/,
  /^(about|contact|joinus|software)\.md$/,
  /^images\/[\w\-][\w\-\.]*\.(jpg|jpeg|png|webp|gif)$/,
  /^images\/sub\/[\w\-][\w\-\.]*\.(jpg|jpeg|png|webp|gif)$/,
  /^images\/lablife\/[\w\-][\w\-\.]*\.(jpg|jpeg|png|webp|gif)$/,
];
const ADMIN_PATHS = [];

function memberAllowed(p) {
  return ALLOWED_PATHS.some(r => r.test(p));
}
function adminAllowed(p) {
  return ADMIN_PATHS.some(r => r.test(p));
}

describe('github-proxy path allowlist regexes', () => {
  it('accepts the documented data files', () => {
    expect(memberAllowed('_data/team.json')).toBe(true);
    expect(memberAllowed('_data/projects.json')).toBe(true);
    expect(memberAllowed('_data/publications.json')).toBe(true);
    expect(memberAllowed('_data/lablife.json')).toBe(true);
  });

  it('accepts the documented page markdown files', () => {
    expect(memberAllowed('about.md')).toBe(true);
    expect(memberAllowed('contact.md')).toBe(true);
    expect(memberAllowed('joinus.md')).toBe(true);
    expect(memberAllowed('software.md')).toBe(true);
  });

  it('accepts profile photos at images/', () => {
    expect(memberAllowed('images/photo.jpg')).toBe(true);
    expect(memberAllowed('images/photo.webp')).toBe(true);
    expect(memberAllowed('images/photo.png')).toBe(true);
  });

  it('accepts project images at images/sub/', () => {
    expect(memberAllowed('images/sub/proj.webp')).toBe(true);
  });

  it('rejects SVG uploads (regression: SVG can carry <script>)', () => {
    expect(memberAllowed('images/evil.svg')).toBe(false);
    expect(memberAllowed('images/sub/evil.svg')).toBe(false);
    expect(memberAllowed('images/lablife/evil.svg')).toBe(false);
  });

  it('rejects path traversal and dotfile tricks', () => {
    expect(memberAllowed('_data/../.github/workflows/foo.yml')).toBe(false);
    expect(memberAllowed('images/../../etc/passwd')).toBe(false);
    expect(memberAllowed('images/.htaccess.png')).toBe(false);
    expect(memberAllowed('images/.git/config')).toBe(false);
  });

  it('rejects double-extension and slash tricks', () => {
    expect(memberAllowed('images/foo.png/bar.png')).toBe(false);
    expect(memberAllowed('images//foo.png')).toBe(false);
  });

  it('rejects writes to .github, _layouts, supabase, scripts', () => {
    for (const p of [
      '.github/workflows/x.yml',
      '_layouts/default.html',
      'supabase/functions/github-proxy/index.ts',
      'scripts/fetch_publications.js',
      'Gemfile',
      'package.json',
    ]) {
      expect(memberAllowed(p), `should reject ${p}`).toBe(false);
      expect(adminAllowed(p), `should reject ${p} for admin too`).toBe(false);
    }
  });

  it('rejects the stale assets/img/sub/ rule that was removed', () => {
    expect(memberAllowed('assets/img/sub/x.png')).toBe(false);
  });

  it('keeps _config.yml writable by any active member', () => {
    expect(memberAllowed('_config.yml')).toBe(true);
  });
});

describe('github-proxy source still has the expected hardening', () => {
  const SRC = readFileSync(resolve(__dirname, '../supabase/functions/github-proxy/index.ts'), 'utf8');

  it('does not list svg in the images/ regex', () => {
    // Find the images/ allowlist line and assert no svg.
    const m = SRC.match(/\^images\\\/[^\n]+\$/g) || [];
    for (const line of m) {
      expect(line, `svg in: ${line}`).not.toMatch(/svg/);
    }
  });

  it('does not list assets/img/sub/ in the allowlist', () => {
    expect(SRC).not.toMatch(/\^assets\\\/img\\\/sub/);
  });

  it('enforces admin role for admin-only paths', () => {
    expect(SRC).toMatch(/profile\.role\s*!==\s*"admin"/);
  });

  it('caps base64 content size', () => {
    expect(SRC).toMatch(/MAX_CONTENT_BASE64_BYTES/);
  });

  it('allowlists workflow filenames', () => {
    expect(SRC).toMatch(/ALLOWED_WORKFLOWS/);
  });

  it('does not echo the profile object on 403 (info leak)', () => {
    // The fix removed `uid: user.id, profile` from the 403 body.
    expect(SRC).not.toMatch(/error:\s*"Forbidden",\s*uid:/);
  });

  it('does not return raw exception strings to the client', () => {
    expect(SRC).not.toMatch(/error:\s*String\(err\)/);
  });

  it('strips control chars from commit messages', () => {
    expect(SRC).toMatch(/safeMessage/);
  });
});
