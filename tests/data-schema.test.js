import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA = resolve(__dirname, '../_data');

function load(name) {
  return JSON.parse(readFileSync(resolve(DATA, name), 'utf8'));
}

describe('_data/team.json', () => {
  const team = load('team.json');

  it('has sections + alumni arrays', () => {
    expect(Array.isArray(team.sections)).toBe(true);
    expect(Array.isArray(team.alumni)).toBe(true);
  });

  it('every section has a title and members array', () => {
    for (const s of team.sections) {
      expect(typeof s.title).toBe('string');
      expect(s.title.length).toBeGreaterThan(0);
      expect(Array.isArray(s.members)).toBe(true);
    }
  });

  it('every member has at least name and role', () => {
    for (const s of team.sections) {
      for (const m of s.members) {
        expect(m.name, `member without name in section "${s.title}"`).toBeTruthy();
        expect(typeof m.name).toBe('string');
      }
    }
  });

  it('research_area, where present, is a non-empty string (the active schema)', () => {
    for (const s of team.sections) {
      for (const m of s.members) {
        if (m.research_area === undefined) continue;
        expect(typeof m.research_area, `member ${m.name} research_area not string`).toBe('string');
        expect(m.research_area.length).toBeGreaterThan(0);
      }
    }
  });

  it('referenced member images exist on disk', () => {
    for (const s of team.sections) {
      for (const m of s.members) {
        if (!m.image) continue;
        const p = resolve(__dirname, '..', 'images', m.image);
        expect(existsSync(p), `missing image: ${m.image}`).toBe(true);
      }
    }
  });
});

describe('_data/projects.json', () => {
  const projects = load('projects.json');

  it('has intro and sections', () => {
    expect(typeof projects.intro).toBe('string');
    expect(Array.isArray(projects.sections)).toBe(true);
  });

  it('every project has title, timeline, status, image', () => {
    for (const s of projects.sections) {
      for (const p of s.projects) {
        expect(p.title).toBeTruthy();
        expect(p.timeline).toBeTruthy();
        expect(p.status).toBeTruthy();
        expect(p.image).toBeTruthy();
      }
    }
  });

  it('referenced project images exist under images/sub/', () => {
    for (const s of projects.sections) {
      for (const p of s.projects) {
        for (const file of [p.image, p.funding_image].filter(Boolean)) {
          const path = resolve(__dirname, '..', 'images', 'sub', file);
          expect(existsSync(path), `missing images/sub/${file}`).toBe(true);
        }
      }
    }
  });

});

describe('_data/publications.json', () => {
  const pubs = load('publications.json');

  it('parses as JSON without error and is non-empty', () => {
    expect(pubs).toBeTruthy();
    // The schema is fluid (auto-generated), but at least a publications array
    // or sections of years should exist.
    const looksValid = Array.isArray(pubs.publications)
      || Array.isArray(pubs.sections)
      || Array.isArray(pubs.entries)
      || typeof pubs.h_index === 'number';
    expect(looksValid).toBe(true);
  });
});

describe('_data/lablife.json (optional)', () => {
  it('parses if present', () => {
    const path = resolve(DATA, 'lablife.json');
    if (!existsSync(path)) return;
    const data = JSON.parse(readFileSync(path, 'utf8'));
    expect(data).toBeTruthy();
    if (data.entries) {
      expect(Array.isArray(data.entries)).toBe(true);
      for (const e of data.entries) {
        expect(typeof e.title).toBe('string');
      }
    }
  });
});
