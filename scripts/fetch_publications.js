#!/usr/bin/env node
/**
 * Fetches all publications from Prof. Myungsik Yoo's Google Scholar profile
 * and writes them to _data/publications.json.
 *
 * Usage: node scripts/fetch_publications.js
 *
 * Google Scholar paginates at 100 per page. This script handles pagination
 * and extracts title, authors, venue, year, citation count, and URLs.
 *
 * Optional environment: OPENALEX_API_KEY; PUBLICATIONS_MAX_AGE_DAYS (default 14).
 * Set ALLOW_PUBLICATION_REMOVALS=1 only after reviewing intentional removals.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const SCHOLAR_ID = 'TARMZOsAAAAJ';
const BASE_URL = 'https://scholar.google.com';
const OUTPUT = path.join(__dirname, '..', '_data', 'publications.json');
const DELAY_MS = 2000; // delay between pagination requests
const ABSTRACT_DELAY_MS = 200;
const MAX_PAGES = 100;
const METRICS = ['total_citations', 'h_index', 'i10_index'];

function publicationId(pub) {
  const url = new URL(pub.url);
  const id = url.searchParams.get('citation_for_view');
  const suffix = id?.startsWith(`${SCHOLAR_ID}:`) ? id.slice(SCHOLAR_ID.length + 1) : '';
  if (url.origin !== BASE_URL || url.pathname !== '/citations' || !/^[A-Za-z0-9_-]+$/.test(suffix)) {
    throw new Error(`Invalid Scholar publication identity for "${pub.title}".`);
  }
  return id;
}

function validatePublications(pubs) {
  if (pubs.length === 0) throw new Error('Publication list is empty.');
  const ids = new Set();
  for (const pub of pubs) {
    if (typeof pub.title !== 'string' || !pub.title.trim() ||
        !Number.isSafeInteger(pub.cited_by) || pub.cited_by < 0 ||
        !Number.isSafeInteger(pub.year) || pub.year < 0) {
      throw new Error('Publication contains an invalid title, citation count, or year.');
    }
    const id = publicationId(pub);
    if (ids.has(id)) throw new Error(`Duplicate Scholar publication ID: ${id}.`);
    ids.add(id);
  }
}

function validateMetrics(stats, count) {
  if (METRICS.some(key => !Number.isSafeInteger(stats[key]) || stats[key] < 0) ||
      stats.h_index > count || stats.i10_index > count || stats.total_citations < stats.h_index ** 2) {
    throw new Error('Scholar author metrics are missing or inconsistent with the publication list.');
  }
}

function loadSnapshot() {
  const data = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  if (data.scholar_id !== SCHOLAR_ID) throw new Error('Cached data belongs to a different Scholar profile.');
  if (!Array.isArray(data.publications)) throw new Error('Cached data must contain a publications array.');
  const pubs = data.publications.flatMap(group => {
    if (!Array.isArray(group.entries)) throw new Error('Cached year group must contain an entries array.');
    return group.entries.map(entry => ({ ...entry, year: group.year }));
  });
  validatePublications(pubs);
  if (data.total_publications !== pubs.length) throw new Error('Cached publication count does not match its entries.');
  validateMetrics(data, pubs.length);
  return { data, pubs };
}

async function getWithRetries(url, options) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await axios.get(url, options);
    } catch (err) {
      const status = err.response?.status;
      const transient = [408, 429, 500, 502, 503, 504].includes(status) ||
        ['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(err.code);
      const retryAfter = err.response?.headers?.['retry-after'];
      let delay = 1000 * 2 ** attempt;
      if (retryAfter !== undefined) {
        const seconds = Number(retryAfter);
        delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
        delay = Math.max(0, delay);
      }
      if (!transient || attempt >= 2 || !Number.isFinite(delay) || delay > 30000) throw err;
      console.warn(`Transient request failure (${status || err.code}); retry ${attempt + 1}/2.`);
      await sleep(delay);
    }
  }
}

function writeSnapshot(result) {
  const temporary = `${OUTPUT}.${randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx');
    fs.writeFileSync(descriptor, JSON.stringify(result, null, 2), 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, OUTPUT);
  } finally {
    try { if (descriptor !== undefined) fs.closeSync(descriptor); } catch (err) {
      console.warn('Failed to close temporary snapshot:', err.message);
    }
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (err) {
      console.warn('Failed to remove temporary snapshot:', err.message);
    }
  }
}

function reportSync(sync, count) {
  const message = sync.status === 'fresh'
    ? `Fresh Scholar synchronization: ${count} publications.`
    : `Using ${count} cached publications; last successful Scholar sync: ${sync.last_success || 'unknown'}. ${sync.reason}`;
  console.log(`\nSync status: ${sync.status}. ${message}`);
  if (sync.status === 'cached') {
    // Escape annotation delimiters so upstream errors cannot inject Actions commands.
    const escaped = message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.warn(`::warning title=Scholar synchronization used cached data::${escaped}`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const safeMessage = message.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Publication synchronization\n\n${safeMessage}\n\n- Status: **${sync.status}**\n- Last successful sync: ${sync.last_success || 'unknown'}\n- Age: ${sync.age_days ?? 'unknown'} days\n- Stale: ${sync.stale ? 'yes' : 'no'}\n`, 'utf8');
  }
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchPage(startIndex) {
  const url = `${BASE_URL}/citations?user=${SCHOLAR_ID}&hl=en&cstart=${startIndex}&pagesize=100&sortby=pubdate`;
  const { data } = await getWithRetries(url, { headers: HEADERS, timeout: 15000 });
  return data;
}

function parsePage(html) {
  const $ = cheerio.load(html);
  const pubs = [];

  $('tr.gsc_a_tr').each((_, row) => {
    const titleEl = $(row).find('a.gsc_a_at');
    const title = titleEl.text().trim();
    const relUrl = titleEl.attr('href') || '';
    const url = relUrl ? new URL(relUrl, BASE_URL).href : '';

    const grayDivs = $(row).find('.gs_gray');
    const authors = $(grayDivs[0]).text().trim();
    const venueText = $(grayDivs[1]).text().trim();

    const citedText = $(row).find('.gsc_a_ac').text().trim();
    const cited_by = citedText ? parseCount(citedText, 'publication citations') : 0;

    const yearText = $(row).find('.gsc_a_y span').text().trim();
    const year = yearText ? parseCount(yearText, 'publication year') : 0;

    // Parse venue — usually "Journal Name, Volume, Pages" or "Conference Name, Pages"
    const venue = venueText.replace(/,\s*\d{4}$/, '').trim();

    // Build citation string similar to existing format
    const citation = venueText
      ? `${authors} - ${venueText}${yearText ? ', ' + yearText : ''}`
      : `${authors}${yearText ? ', ' + yearText : ''}`;

    if (title) {
      pubs.push({ title, url, citation, cited_by, venue, authors, year });
    }
  });

  return pubs;
}

async function fetchAbstractFromOpenAlex(title) {
  const query = encodeURIComponent(title.replace(/[☆★†‡§☆☆]/g, '').trim());
  const { data } = await getWithRetries(
    `https://api.openalex.org/works?search=${query}&per_page=1&select=title,abstract_inverted_index`,
    {
      timeout: 10000,
      headers: { 'User-Agent': 'ANDA-Lab (mailto:hpnq.work@outlook.com)' },
      params: process.env.OPENALEX_API_KEY ? { api_key: process.env.OPENALEX_API_KEY } : {},
    }
  );
  const work = data?.results?.[0];
  const normalize = value => (value || '').normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (!work?.abstract_inverted_index || normalize(work.title) !== normalize(title)) return '';
  // OpenAlex stores abstracts as inverted index — reconstruct to plain text.
  const words = [];
  for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
    for (const pos of positions) {
      if (!Number.isSafeInteger(pos) || pos < 0 || pos >= 10000) throw new Error('Invalid OpenAlex abstract position.');
      words[pos] = word;
    }
  }
  return words.join(' ').trim();
}

function hasMorePages(html) {
  const $ = cheerio.load(html);
  // If the "Show more" button is disabled, no more pages
  const btn = $('#gsc_bpf_more');
  if (btn.length === 0) {
    throw new Error('Google Scholar returned no pagination controls; the publication list may be incomplete.');
  }
  return btn.attr('disabled') === undefined;
}

function parseCount(text, label) {
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) throw new Error(`Invalid ${label}: "${text}".`);
  const value = Number(text.replace(/,/g, ''));
  if (!Number.isSafeInteger(value)) throw new Error(`Invalid ${label}: number is too large.`);
  return value;
}

function fetchAuthorStats(html) {
  const $ = cheerio.load(html);
  const stats = {};
  const cells = $('#gsc_rsb_st td.gsc_rsb_std');
  if (cells.length < 6) throw new Error('Scholar author metrics table is incomplete.');
  METRICS.forEach((key, i) => { stats[key] = parseCount($(cells[i * 2]).text().trim(), key); });
  return stats;
}

async function main() {
  console.log(`Fetching publications for Scholar ID: ${SCHOLAR_ID}`);

  let allPubs = [];
  let startIndex = 0;
  let firstPageHtml = null;
  let stats = {};
  let usedCachedData = false;
  const attemptedAt = new Date().toISOString();
  let lastUpdated = attemptedAt.split('T')[0];
  const maxAgeDays = Number(process.env.PUBLICATIONS_MAX_AGE_DAYS || 14);
  if (!Number.isSafeInteger(maxAgeDays) || maxAgeDays < 1) throw new Error('PUBLICATIONS_MAX_AGE_DAYS must be a positive integer.');
  let snapshot;
  let cacheError;
  let fallbackReason;
  try { snapshot = loadSnapshot(); } catch (err) { cacheError = err; }

  try {
    while (true) {
      if (startIndex / 100 >= MAX_PAGES) throw new Error('Scholar pagination exceeded its safety limit.');
      console.log(`  Fetching page starting at index ${startIndex}...`);
      const html = await fetchPage(startIndex);
      if (startIndex === 0) firstPageHtml = html;

      const pubs = parsePage(html);
      if (pubs.length === 0) {
        throw new Error(`Google Scholar returned no publications at index ${startIndex}; refusing an empty or incomplete scrape.`);
      }
      const morePages = hasMorePages(html);
      if (morePages && pubs.length < 100) {
        throw new Error(`Google Scholar returned an incomplete page at index ${startIndex}.`);
      }

      allPubs = allPubs.concat(pubs);
      validatePublications(allPubs);
      console.log(`  Got ${pubs.length} publications (total: ${allPubs.length})`);

      if (!morePages) break;

      startIndex += 100;
      await sleep(DELAY_MS);
    }
    stats = fetchAuthorStats(firstPageHtml);
    validateMetrics(stats, allPubs.length);
    if (snapshot && process.env.ALLOW_PUBLICATION_REMOVALS !== '1') {
      if (allPubs.length < snapshot.pubs.length) {
        throw new Error(`Scholar publication count fell from ${snapshot.pubs.length} to ${allPubs.length}; intentional removals require review.`);
      }
      const fetchedIds = new Set(allPubs.map(publicationId));
      const missingCount = snapshot.pubs.filter(pub => !fetchedIds.has(publicationId(pub))).length;
      if (missingCount > 0) {
        throw new Error(`Scholar omitted ${missingCount} previously saved publication(s); intentional removals require review.`);
      }
    }
  } catch (err) {
    fallbackReason = err.message;
    console.warn('Could not fetch a complete Scholar publication list:', err.message);
    console.log('Falling back to existing publications — will still update abstracts.');
    try {
      if (!snapshot) throw cacheError;
      const existing = snapshot.data;
      // Discard partial downloads and retain the last complete Scholar snapshot.
      allPubs = snapshot.pubs;
      stats = {
        total_citations: existing.total_citations,
        h_index: existing.h_index,
        i10_index: existing.i10_index,
      };
      usedCachedData = true;
      lastUpdated = existing.last_updated || null;
      console.log(`  Loaded ${allPubs.length} existing publications (Scholar sync date unchanged).`);
    } catch (fallbackErr) {
      console.error('Failed to load cached publications:', fallbackErr.message);
      throw fallbackErr;
    }
  }

  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(lastUpdated || '') ? Date.parse(`${lastUpdated}T00:00:00Z`) : NaN;
  const ageDays = Number.isFinite(parsedDate) && new Date(parsedDate).toISOString().split('T')[0] === lastUpdated &&
    parsedDate <= Date.parse(attemptedAt)
    ? Math.floor((Date.parse(attemptedAt) - parsedDate) / 86400000) : null;
  const sync = {
    status: usedCachedData ? 'cached' : 'fresh',
    last_attempt: attemptedAt,
    last_success: lastUpdated,
    age_days: ageDays,
    stale: ageDays === null || ageDays > maxAgeDays,
    ...(usedCachedData ? { reason: fallbackReason } : {}),
  };
  if (sync.stale) {
    reportSync(sync, allPubs.length);
    throw new Error(`Scholar data is stale (age: ${ageDays ?? 'unknown'} days; limit: ${maxAgeDays}). Saved publications remain unchanged.`);
  }

  // Preserve abstracts by stable Scholar ID across both fresh and cached runs.
  const savedAbstracts = new Map((snapshot?.pubs || []).map(pub => [publicationId(pub), pub.description || '']));
  for (const pub of allPubs) pub.description = savedAbstracts.get(publicationId(pub)) || pub.description || '';
  // OpenAlex has an anonymous usage budget; stop a batch when authorization or quota fails.
  console.log(`\nEnriching missing abstracts for ${allPubs.length} publications...`);
  let found = 0;
  let openAlexUnavailable = false;
  let abstractErrors = 0;
  for (let i = 0; i < allPubs.length; i++) {
    const pub = allPubs[i];
    console.log(`  [${i + 1}/${allPubs.length}] ${pub.title.substring(0, 60)}...`);
    let description = '';
    let queried = false;
    if (!pub.description && !openAlexUnavailable) {
      queried = true;
      try { description = await fetchAbstractFromOpenAlex(pub.title); } catch (err) {
        abstractErrors++;
        if ([401, 403, 429].includes(err.response?.status) || abstractErrors >= 3) openAlexUnavailable = true;
        if (abstractErrors === 1) console.warn('OpenAlex enrichment failed; saved abstracts will be retained:', err.message);
      }
    }
    pub.description = description || pub.description || '';
    if (pub.description) { found++; process.stdout.write('    ✓\n'); }
    if (queried && !openAlexUnavailable && i < allPubs.length - 1) await sleep(ABSTRACT_DELAY_MS);
  }
  console.log(`  Found abstracts for ${found}/${allPubs.length} publications`);
  if (abstractErrors) console.warn(`::warning title=Abstract enrichment incomplete::${abstractErrors} OpenAlex request(s) failed; existing abstracts were retained.`);

  // Group by year, sort descending
  const yearMap = {};
  for (const pub of allPubs) {
    const y = pub.year || 0;
    if (!yearMap[y]) yearMap[y] = [];
    yearMap[y].push({
      title: pub.title,
      url: pub.url,
      citation: pub.citation,
      cited_by: pub.cited_by,
      venue: pub.venue,
      authors: pub.authors,
      description: pub.description || '',
    });
  }

  // Preserve Scholar's original order (publication date) within each year

  // Build output array sorted by year descending
  // Keep year=0 entries under "Other" to avoid silently dropping publications
  const years = Object.keys(yearMap)
    .map(Number)
    .sort((a, b) => b - a);

  const output = years.map(y => ({ year: y, entries: yearMap[y] }));

  // Add metadata
  const result = {
    last_updated: lastUpdated,
    scholar_id: SCHOLAR_ID,
    scholar_url: `${BASE_URL}/citations?user=${SCHOLAR_ID}&hl=en`,
    total_publications: allPubs.length,
    sync,
    ...stats,
    publications: output,
  };

  writeSnapshot(result);
  reportSync(sync, allPubs.length);

  console.log(`\nDone! Written to ${OUTPUT}`);
  console.log(`  Total publications: ${result.total_publications}`);
  console.log(`  Years: ${years[years.length - 1]} - ${years[0]}`);
  if (stats.total_citations) {
    console.log(`  Total citations: ${stats.total_citations}`);
    console.log(`  h-index: ${stats.h_index}`);
  }
  console.log(`  Last updated: ${result.last_updated}`);
}

main().catch(err => {
  console.error('Publication update failed:', err.message);
  process.exitCode = 1;
});
