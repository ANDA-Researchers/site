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
    h_index: Math.min(34, count),
    i10_index: Math.min(90, count),
    publications: [{
      year: 2025,
      entries: Array.from({ length: count }, (_, i) => ({
        title: `Cached publication ${i}`,
        url: `https://scholar.google.com/citations?citation_for_view=TARMZOsAAAAJ:cached${i}`,
        citation: 'Cached authors - Cached journal, 2025',
        cited_by: i + 1,
        venue: 'Cached journal',
        authors: 'Cached authors',
        description: `Saved abstract ${i}`,
      })),
    }],
  };
}

function scholarPage(count, { start = 0, more = false, pagination = true, year = 2026,
  metrics = [12345, 1000, Math.min(45, count), 12, Math.min(50, count), 5] } = {}) {
  const rows = Array.from({ length: count }, (_, i) => `
    <tr class="gsc_a_tr">
      <td><a class="gsc_a_at" href="/citations?citation_for_view=TARMZOsAAAAJ:pub${start + i}">Publication ${start + i}</a>
        <div class="gs_gray">Authors</div><div class="gs_gray">Journal, 2026</div></td>
      <td><a class="gsc_a_ac">7</a></td>
      <td class="gsc_a_y"><span>${year || ''}</span></td>
    </tr>`).join('');
  return `<html><body>
    <table id="gsc_rsb_st"><tr>${metrics
      .map(value => `<td class="gsc_rsb_std">${value}</td>`).join('')}</tr></table>
    <table>${rows}</table>
    ${pagination ? `<button id="gsc_bpf_more"${more ? '' : ' disabled'}>Show more</button>` : ''}
  </body></html>`;
}

function snapshotWithMatchingIds() {
  const snapshot = cachedPublications();
  snapshot.publications[0].entries.forEach((pub, i) => {
    pub.url = `https://scholar.google.com/citations?citation_for_view=TARMZOsAAAAJ:pub${i}`;
    pub.description = '';
  });
  return snapshot;
}

async function runScript({ pages, cache = snapshotWithMatchingIds(), cacheError, abstract,
  now = '2026-10-10T12:00:00Z', env = {}, writeError, flushError, renameError } = {}) {
  const requests = [];
  const logs = [];
  let pageIndex = 0;
  const sleepDelays = [];
  const summaries = [];
  const requestOptions = [];
  let temporaryText;
  let savedText;
  let temporaryExists = false;
  const writeFileSync = vi.fn((_, value) => { if (writeError) throw writeError; temporaryText = value; });
  const renameSync = vi.fn(() => { if (renameError) throw renameError; savedText = temporaryText; temporaryExists = false; });
  const unlinkSync = vi.fn(() => { temporaryExists = false; });
  const fsyncSync = vi.fn(() => { if (flushError) throw flushError; });
  const sandbox = {
    require(name) {
      if (name === 'axios') return {
        async get(url, options) {
          requests.push(url);
          requestOptions.push(options);
          if (url.startsWith('https://scholar.google.com/')) {
            const page = pages[pageIndex++];
            if (page instanceof Error) throw page;
            if (page === undefined) throw new Error('Unexpected extra Scholar request');
            return { data: page };
          }
          if (abstract instanceof Error) throw abstract;
          const work = typeof abstract === 'function' ? abstract(url) : abstract;
          if (work instanceof Error) throw work;
          return { data: { results: work === undefined ? [] : [{
            title: new URL(url).searchParams.get('search'), ...work,
          }] } };
        },
      };
      if (name === 'cheerio') return cheerio;
      if (name === 'path') return path;
      if (name === 'crypto') return require('crypto');
      if (name === 'fs') return {
        readFileSync() {
          if (cacheError) throw cacheError;
          return typeof cache === 'string' ? cache : JSON.stringify(cache);
        },
        writeFileSync,
        openSync() { temporaryExists = true; return 42; },
        fsyncSync,
        closeSync() {},
        renameSync,
        existsSync() { return temporaryExists; },
        unlinkSync,
        appendFileSync(_, value) { summaries.push(value); },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    __dirname: resolve(__dirname, '../scripts'),
    URL,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return Date.parse(now); }
    },
    console: Object.fromEntries(['log', 'warn', 'error'].map(level => [level,
      (...args) => logs.push(args.join(' ')),
    ])),
    process: {
      exitCode: 0,
      env,
      exit(code) { this.exitCode = code; throw new Error(`Process exited with ${code}`); },
      stdout: { write() {} },
    },
    setTimeout(callback, delay) { sleepDelays.push(delay); callback(); },
  };
  try {
    await runInNewContext(source, sandbox, { filename: 'fetch_publications.js' });
  } catch (error) {
    sandbox.process.exitCode = 1;
    logs.push(error.message);
  }
  return {
    exitCode: sandbox.process.exitCode,
    output: savedText ? JSON.parse(savedText) : null,
    writeFileSync,
    renameSync,
    fsyncSync,
    unlinkSync,
    temporaryExists,
    sleepDelays,
    summary: summaries.join(''),
    requests,
    requestOptions,
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
      h_index: 2,
      i10_index: 2,
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
    ['missing publications array', { cache: { scholar_id: 'TARMZOsAAAAJ' } }, 'publications array'],
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

  it('fills missing cached abstracts without changing the Scholar sync date', async () => {
    const cache = cachedPublications();
    cache.publications[0].entries[0].description = '';
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
      total_publications: 2, total_citations: 12345, h_index: 2, i10_index: 2,
      last_updated: '2026-10-10',
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

  it('preserves saved abstracts by ID during a fresh scrape even when titles change', async () => {
    const cache = cachedPublications();
    cache.publications[0].entries.forEach((pub, i) => {
      pub.url = `https://scholar.google.com/citations?citation_for_view=TARMZOsAAAAJ:pub${i}`;
    });
    const result = await runScript({ pages: [scholarPage(2)], cache, abstract: new Error('OpenAlex unavailable') });
    expect(result.exitCode).toBe(0);
    expect(result.output.sync.status).toBe('fresh');
    expect(result.output.publications[0].entries.map(pub => pub.description)).toEqual(['Saved abstract 0', 'Saved abstract 1']);
    expect(result.requests.filter(url => url.startsWith('https://api.openalex.org/'))).toHaveLength(0);
  });

  it('rejects repeated pages rather than saving duplicate publications', async () => {
    const cache = cachedPublications(105);
    const result = await runScript({ pages: [scholarPage(100, { more: true }), scholarPage(100)], cache });
    expect(result.output.publications).toEqual(cache.publications);
    expect(result.output.sync).toMatchObject({ status: 'cached', reason: expect.stringContaining('Duplicate') });
  });

  it('rejects duplicate IDs within a single page', async () => {
    const result = await runScript({ pages: [scholarPage(2).replaceAll('TARMZOsAAAAJ:pub1', 'TARMZOsAAAAJ:pub0')] });
    expect(result.output.sync.status).toBe('cached');
    expect(result.output.total_publications).toBe(2);
  });

  it.each([
    ['another Scholar profile', scholarPage(2).replaceAll('TARMZOsAAAAJ:pub', 'AnotherProfile:pub')],
    ['a foreign website', scholarPage(2).replaceAll('href="/citations', 'href="https://example.com/citations')],
    ['invalid citation counts', scholarPage(2).replaceAll('class="gsc_a_ac">7', 'class="gsc_a_ac">unknown')],
    ['invalid publication years', scholarPage(2).replaceAll('<span>2026</span>', '<span>2026junk</span>')],
    ['an incomplete metric table', scholarPage(2, { metrics: [12345, 1000] })],
    ['malformed metrics', scholarPage(2, { metrics: ['12,34', 1000, 2, 12, 2, 5] })],
    ['metrics larger than the publication count', scholarPage(2, { metrics: [12345, 1000, 45, 12, 50, 5] })],
  ])('retains the snapshot when Scholar returns %s', async (_, page) => {
    const cache = cachedPublications();
    const result = await runScript({ pages: [page], cache });
    expect(result.exitCode).toBe(0);
    expect(result.output.sync.status).toBe('cached');
    expect(result.output.publications).toEqual(cache.publications);
  });

  it('parses comma-separated citation totals without truncation', async () => {
    const result = await runScript({ pages: [scholarPage(2, { metrics: ['12,345', 1000, 2, 12, 2, 5] })] });
    expect(result.output.sync.status).toBe('fresh');
    expect(result.output.total_citations).toBe(12345);
  });

  it('requires review before automatically removing saved publications', async () => {
    const result = await runScript({ pages: [scholarPage(1)] });
    expect(result.output.sync).toMatchObject({ status: 'cached', reason: expect.stringContaining('count fell') });
    expect(result.output.total_publications).toBe(2);
  });

  it.each([2, 3])('rejects missing saved IDs even when the new count is %s', async count => {
    const result = await runScript({ pages: [scholarPage(count).replaceAll('TARMZOsAAAAJ:pub1', 'TARMZOsAAAAJ:replacement')] });
    expect(result.output.sync.status).toBe('cached');
    expect(result.output.total_publications).toBe(2);
    expect(result.logs).toContain('previously saved publication');
  });

  it('accepts legitimate additions while retaining every saved publication ID', async () => {
    const result = await runScript({ pages: [scholarPage(3)] });
    expect(result.output.sync.status).toBe('fresh');
    expect(result.output.total_publications).toBe(3);
  });

  it('supports explicitly reviewed removals while keeping other validation active', async () => {
    const result = await runScript({ pages: [scholarPage(1)], env: { ALLOW_PUBLICATION_REMOVALS: '1' } });
    expect(result.output.sync.status).toBe('fresh');
    expect(result.output.total_publications).toBe(1);
  });

  it('rejects a cached snapshot whose declared count differs from its entries', async () => {
    const cache = cachedPublications();
    cache.total_publications = 5;
    const result = await runScript({ pages: [new Error('HTTP 403')], cache });
    expect(result.exitCode).toBe(1);
    expect(result.writeFileSync).not.toHaveBeenCalled();
    expect(result.logs).toContain('count does not match');
  });

  it('reports cached status and its actual age in Actions warnings and the run summary', async () => {
    const result = await runScript({ pages: [new Error('HTTP 403')], env: { GITHUB_STEP_SUMMARY: 'summary.md' } });
    expect(result.output.sync).toMatchObject({
      status: 'cached', last_success: '2026-10-08', age_days: 2, stale: false,
      last_attempt: '2026-10-10T12:00:00.000Z',
    });
    expect(result.logs).toContain('::warning title=Scholar synchronization used cached data::');
    expect(result.summary).toContain('Status: **cached**');
    expect(result.summary).toContain('Age: 2 days');
  });

  it('fails visibly when cached data is older than two weekly refresh intervals', async () => {
    const result = await runScript({
      pages: [new Error('HTTP 403')], now: '2026-10-23T12:00:00Z',
      env: { GITHUB_STEP_SUMMARY: 'summary.md' },
    });
    expect(result.exitCode).toBe(1);
    expect(result.writeFileSync).not.toHaveBeenCalled();
    expect(result.logs).toContain('Scholar data is stale');
    expect(result.summary).toContain('Stale: yes');
  });

  it('accepts cached data exactly at the configured age limit', async () => {
    const result = await runScript({ pages: [new Error('HTTP 403')], now: '2026-10-22T12:00:00Z' });
    expect(result.exitCode).toBe(0);
    expect(result.output.sync.age_days).toBe(14);
  });

  it('fails on an unknown cached sync date rather than pretending it is fresh', async () => {
    const cache = cachedPublications();
    delete cache.last_updated;
    const result = await runScript({ pages: [new Error('HTTP 403')], cache });
    expect(result.exitCode).toBe(1);
    expect(result.writeFileSync).not.toHaveBeenCalled();
    expect(result.logs).toContain('age: unknown');
  });

  it.each(['2026-02-31', '2026-12-01'])('rejects an invalid or future sync date: %s', async lastUpdated => {
    const cache = cachedPublications();
    cache.last_updated = lastUpdated;
    const result = await runScript({ pages: [new Error('HTTP 403')], cache });
    expect(result.exitCode).toBe(1);
    expect(result.writeFileSync).not.toHaveBeenCalled();
    expect(result.logs).toContain('age: unknown');
  });

  it('passes an optional OpenAlex key without putting it in log messages', async () => {
    const result = await runScript({ pages: [scholarPage(2)], env: { OPENALEX_API_KEY: 'test-only-key' } });
    const requestIndex = result.requests.findIndex(url => url.startsWith('https://api.openalex.org/'));
    expect(result.requestOptions[requestIndex].params.api_key).toBe('test-only-key');
    expect(result.logs).not.toContain('test-only-key');
  });

  it('only enriches abstracts from an OpenAlex result with a matching title', async () => {
    const result = await runScript({
      pages: [scholarPage(2)],
      abstract: { title: 'An unrelated publication', abstract_inverted_index: { Wrong: [0], abstract: [1] } },
    });
    expect(result.output.publications[0].entries.every(pub => pub.description === '')).toBe(true);
  });

  it('stops enrichment after a quota failure and respects a long Retry-After', async () => {
    const error = Object.assign(new Error('OpenAlex quota exhausted'), {
      response: { status: 429, headers: { 'retry-after': '60' } },
    });
    const result = await runScript({ pages: [scholarPage(2)], abstract: error });
    expect(result.exitCode).toBe(0);
    expect(result.requests.filter(url => url.startsWith('https://api.openalex.org/'))).toHaveLength(1);
    expect(result.logs).toContain('Abstract enrichment incomplete');
  });

  it('retries transient Scholar failures with bounded backoff', async () => {
    const error = Object.assign(new Error('HTTP 503'), { response: { status: 503, headers: {} } });
    const result = await runScript({ pages: [error, error, scholarPage(2)] });
    expect(result.output.sync.status).toBe('fresh');
    expect(result.requests.filter(url => url.startsWith('https://scholar.google.com/'))).toHaveLength(3);
    expect(result.sleepDelays.slice(0, 2)).toEqual([1000, 2000]);
  });

  it('does not repeatedly retry permanent Scholar access denial', async () => {
    const error = Object.assign(new Error('HTTP 403'), { response: { status: 403, headers: {} } });
    const result = await runScript({ pages: [error] });
    expect(result.output.sync.status).toBe('cached');
    expect(result.requests.filter(url => url.startsWith('https://scholar.google.com/'))).toHaveLength(1);
  });

  it('stops an enrichment batch after three exhausted transient request failures', async () => {
    const error = Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' });
    const result = await runScript({ pages: [scholarPage(4)], abstract: error });
    expect(result.exitCode).toBe(0);
    expect(result.requests.filter(url => url.startsWith('https://api.openalex.org/'))).toHaveLength(9);
    expect(result.output.total_publications).toBe(4);
  });

  it.each([
    ['writing', { writeError: new Error('Disk full') }],
    ['flushing', { flushError: new Error('Flush failed') }],
    ['replacement', { renameError: new Error('Replacement failed') }],
  ])('retains the original snapshot and cleans up the temporary file after %s fails', async (_, options) => {
    const result = await runScript({ pages: [scholarPage(2)], ...options });
    expect(result.exitCode).toBe(1);
    expect(result.output).toBeNull();
    expect(result.temporaryExists).toBe(false);
    expect(result.unlinkSync).toHaveBeenCalledOnce();
    expect(result.logs).not.toContain('Sync status: fresh');
  });

  it('flushes a complete temporary snapshot before replacing the saved file', async () => {
    const result = await runScript({ pages: [scholarPage(2)] });
    expect(result.fsyncSync).toHaveBeenCalledOnce();
    expect(result.renameSync).toHaveBeenCalledOnce();
    expect(result.writeFileSync.mock.invocationCallOrder[0]).toBeLessThan(result.fsyncSync.mock.invocationCallOrder[0]);
    expect(result.fsyncSync.mock.invocationCallOrder[0]).toBeLessThan(result.renameSync.mock.invocationCallOrder[0]);
    const [temporary, target] = result.renameSync.mock.calls[0];
    expect(path.dirname(temporary)).toBe(path.dirname(target));
    expect(temporary).not.toBe(target);
  });
});
