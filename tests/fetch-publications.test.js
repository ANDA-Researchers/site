// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import path from 'node:path';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const cheerio = require('cheerio');
const source = readFileSync(resolve(__dirname, '../scripts/fetch_publications.js'), 'utf8');

function cachedPublications(count = 2) {
  return {
    last_updated: '2026-10-08',
    scholar_id: 'TARMZOsAAAAJ',
    total_publications: count,
    total_citations: 8975,
    h_index: 34,
    i10_index: 90,
    publications: [{
      year: 2025,
      entries: Array.from({ length: count }, (_, i) => ({
        title: `Cached publication ${i}`,
        url: `https://scholar.google.com/citations?citation_for_view=cached${i}`,
        citation: 'Cached authors - Cached journal, 2025',
        cited_by: i + 1,
        venue: 'Cached journal',
        authors: 'Cached authors',
        description: `Saved abstract ${i}`,
      })),
    }],
  };
}

function scholarPage(count, { start = 0, more = false, pagination = true, year = 2026 } = {}) {
  const rows = Array.from({ length: count }, (_, i) => `
    <tr class="gsc_a_tr">
      <td><a class="gsc_a_at" href="/citations?citation_for_view=pub${start + i}">Publication ${start + i}</a>
        <div class="gs_gray">Authors</div><div class="gs_gray">Journal, 2026</div></td>
      <td><a class="gsc_a_ac">7</a></td>
      <td class="gsc_a_y"><span>${year || ''}</span></td>
    </tr>`).join('');
  return `<html><body>
    <table id="gsc_rsb_st"><tr>${[12345, 1000, 45, 12, 50, 5]
      .map(value => `<td class="gsc_rsb_std">${value}</td>`).join('')}</tr></table>
    <table>${rows}</table>
    ${pagination ? `<button id="gsc_bpf_more"${more ? '' : ' disabled'}>Show more</button>` : ''}
  </body></html>`;
}

async function runScript({ pages, cache = cachedPublications(), cacheError, abstract } = {}) {
  const requests = [];
  const logs = [];
  let pageIndex = 0;
  const writeFileSync = vi.fn();
  const sandbox = {
    require(name) {
      if (name === 'axios') return {
        async get(url) {
          requests.push(url);
          if (url.startsWith('https://scholar.google.com/')) {
            const page = pages[pageIndex++];
            if (page instanceof Error) throw page;
            if (page === undefined) throw new Error('Unexpected extra Scholar request');
            return { data: page };
          }
          if (abstract instanceof Error) throw abstract;
          return { data: { results: abstract === undefined ? [] : [abstract] } };
        },
      };
      if (name === 'cheerio') return cheerio;
      if (name === 'path') return path;
      if (name === 'fs') return {
        readFileSync() {
          if (cacheError) throw cacheError;
          return typeof cache === 'string' ? cache : JSON.stringify(cache);
        },
        writeFileSync,
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    __dirname: resolve(__dirname, '../scripts'),
    console: Object.fromEntries(['log', 'warn', 'error'].map(level => [level,
      (...args) => logs.push(args.join(' ')),
    ])),
    process: {
      exitCode: 0,
      exit(code) { this.exitCode = code; throw new Error(`Process exited with ${code}`); },
      stdout: { write() {} },
    },
    setTimeout(callback) { callback(); },
  };
  try {
    await runInNewContext(source, sandbox, { filename: 'fetch_publications.js' });
  } catch (error) {
    sandbox.process.exitCode = 1;
    logs.push(error.message);
  }
  return {
    exitCode: sandbox.process.exitCode,
    output: writeFileSync.mock.calls.length ? JSON.parse(writeFileSync.mock.lastCall[1]) : null,
    writeFileSync,
    requests,
    logs: logs.join('\n'),
  };
}

describe('publication update safeguards', () => {
  it('uses cached publications, metrics, abstracts, and sync date after HTTP 403', async () => {
    const cache = cachedPublications();
    const result = await runScript({
      pages: [new Error('Request failed with status code 403')],
      cache,
      abstract: new Error('OpenAlex unavailable'),
    });
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchObject({
      total_publications: 2,
      total_citations: 8975,
      h_index: 34,
      i10_index: 90,
      last_updated: cache.last_updated,
      publications: cache.publications,
    });
    expect(result.logs).toContain('403');
    expect(result.logs).not.toContain('before initialization');
  });

  it('rejects HTTP 200 without publications and preserves cached author metrics', async () => {
    const cache = cachedPublications();
    const result = await runScript({ pages: [scholarPage(0)], cache });
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchObject({ total_publications: 2, total_citations: 8975 });
    expect(result.output.publications).toEqual(cache.publications);
    expect(result.logs).toContain('no publications');
  });

  it.each([
    ['HTTP 403', new Error('Request failed with status code 403')],
    ['an empty page', scholarPage(0)],
  ])('discards the partial download when a later page returns %s', async (_, secondPage) => {
    const cache = cachedPublications(105);
    const result = await runScript({ pages: [scholarPage(100, { more: true }), secondPage], cache });
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatchObject({ total_publications: 105, total_citations: 8975 });
    expect(result.output.publications).toEqual(cache.publications);
    expect(result.output.last_updated).toBe(cache.last_updated);
    expect(result.requests.filter(url => url.startsWith('https://scholar.google.com/'))).toHaveLength(2);
  });

  it.each([
    ['missing file', { cacheError: new Error('ENOENT: cached publications file is missing') }, 'ENOENT'],
    ['invalid JSON', { cache: '{invalid JSON' }, 'JSON'],
    ['missing publications array', { cache: {} }, 'publications array'],
    ['empty publication list', { cache: cachedPublications(0) }, 'empty'],
  ])('logs the actual %s fallback error and leaves the file untouched', async (_, options, message) => {
    const result = await runScript({ pages: [new Error('HTTP 403')], ...options });
    expect(result.exitCode).toBe(1);
    expect(result.writeFileSync).not.toHaveBeenCalled();
    expect(result.logs).toContain(message);
  });

  it('leaves the file untouched when both the response and cache are empty', async () => {
    const result = await runScript({ pages: [scholarPage(0)], cache: cachedPublications(0) });
    expect(result.exitCode).toBe(1);
    expect(result.writeFileSync).not.toHaveBeenCalled();
  });

  it.each([
    ['a short page with more results', scholarPage(2, { more: true })],
    ['missing pagination controls', scholarPage(100, { pagination: false })],
  ])('rejects %s instead of saving an incomplete list', async (_, page) => {
    const cache = cachedPublications(105);
    const result = await runScript({ pages: [page], cache });
    expect(result.exitCode).toBe(0);
    expect(result.output.publications).toEqual(cache.publications);
  });

  it('updates cached abstracts when OpenAlex succeeds without changing the Scholar sync date', async () => {
    const cache = cachedPublications();
    const result = await runScript({
      pages: [new Error('HTTP 403')],
      cache,
      abstract: { abstract_inverted_index: { Updated: [0], abstract: [1] } },
    });
    expect(result.exitCode).toBe(0);
    expect(result.output.publications[0].entries[0].description).toBe('Updated abstract');
    expect(result.output.last_updated).toBe(cache.last_updated);
  });

  it('writes a complete successful scrape with fresh metrics and reconstructed abstracts', async () => {
    const result = await runScript({
      pages: [scholarPage(2)],
      abstract: { abstract_inverted_index: { Fresh: [0], abstract: [1] } },
    });
    expect(result.exitCode).toBe(0);
    expect(result.writeFileSync).toHaveBeenCalledOnce();
    expect(result.output).toMatchObject({
      total_publications: 2, total_citations: 12345, h_index: 45, i10_index: 50,
      last_updated: new Date().toISOString().split('T')[0],
    });
    expect(result.output.publications[0].entries.map(pub => pub.title)).toEqual(['Publication 0', 'Publication 1']);
    expect(result.output.publications[0].entries[0].description).toBe('Fresh abstract');
  });

  it('fetches all pages in order and preserves publications with no year', async () => {
    const result = await runScript({
      pages: [scholarPage(100, { more: true }), scholarPage(2, { start: 100, year: 0 })],
    });
    expect(result.exitCode).toBe(0);
    expect(result.output.total_publications).toBe(102);
    expect(result.output.publications.map(group => group.year)).toEqual([2026, 0]);
    expect(result.output.publications[0].entries).toHaveLength(100);
    expect(result.output.publications[1].entries.map(pub => pub.title)).toEqual(['Publication 100', 'Publication 101']);
    expect(result.requests.filter(url => url.startsWith('https://scholar.google.com/'))[1]).toContain('cstart=100');
  });

  it('accepts exactly 100 publications when the next-page button is disabled', async () => {
    const result = await runScript({ pages: [scholarPage(100)] });
    expect(result.exitCode).toBe(0);
    expect(result.output.total_publications).toBe(100);
    expect(result.requests.filter(url => url.startsWith('https://scholar.google.com/'))).toHaveLength(1);
  });
});
