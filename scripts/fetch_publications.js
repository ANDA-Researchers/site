#!/usr/bin/env node
/**
 * Fetches all publications from Prof. Myungsik Yoo's Google Scholar profile
 * and writes them to _data/publications.json.
 *
 * Usage: node scripts/fetch_publications.js
 *
 * Google Scholar paginates at 100 per page. This script handles pagination
 * and extracts title, authors, venue, year, citation count, and URLs.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const SCHOLAR_ID = 'TARMZOsAAAAJ';
const BASE_URL = 'https://scholar.google.com';
const OUTPUT = path.join(__dirname, '..', '_data', 'publications.json');
const DELAY_MS = 2000; // delay between requests to avoid blocking
const DETAIL_DELAY_MS = 1500; // delay between detail page requests

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchPage(startIndex) {
  const url = `${BASE_URL}/citations?user=${SCHOLAR_ID}&hl=en&cstart=${startIndex}&pagesize=100&sortby=pubdate`;
  const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  return data;
}

function parsePage(html) {
  const $ = cheerio.load(html);
  const pubs = [];

  $('tr.gsc_a_tr').each((_, row) => {
    const titleEl = $(row).find('a.gsc_a_at');
    const title = titleEl.text().trim();
    const relUrl = titleEl.attr('href') || '';
    const url = relUrl ? `${BASE_URL}${relUrl}` : '';

    const grayDivs = $(row).find('.gs_gray');
    const authors = $(grayDivs[0]).text().trim();
    const venueText = $(grayDivs[1]).text().trim();

    const citedText = $(row).find('.gsc_a_ac').text().trim();
    const cited_by = parseInt(citedText, 10) || 0;

    const yearText = $(row).find('.gsc_a_y span').text().trim();
    const year = parseInt(yearText, 10) || null;

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

async function fetchDescription(pubUrl) {
  try {
    const { data } = await axios.get(pubUrl, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(data);
    // Description is in .gsc_oci_value next to .gsc_oci_field containing "Description"
    let desc = '';
    $('.gsc_oci_field').each((_, el) => {
      if ($(el).text().trim().toLowerCase() === 'description') {
        desc = $(el).next('.gsc_oci_value').text().trim();
      }
    });
    return desc || '';
  } catch {
    return '';
  }
}

function hasMorePages(html) {
  const $ = cheerio.load(html);
  // If the "Show more" button is disabled, no more pages
  const btn = $('#gsc_bpf_more');
  return btn.length > 0 && !btn.attr('disabled');
}

async function fetchAuthorStats(html) {
  const $ = cheerio.load(html);
  const stats = {};
  const cells = $('#gsc_rsb_st td.gsc_rsb_std');
  if (cells.length >= 2) {
    stats.total_citations = parseInt($(cells[0]).text().trim(), 10) || 0;
    stats.h_index = parseInt($(cells[2]).text().trim(), 10) || 0;
    stats.i10_index = parseInt($(cells[4]).text().trim(), 10) || 0;
  }
  return stats;
}

async function main() {
  console.log(`Fetching publications for Scholar ID: ${SCHOLAR_ID}`);

  let allPubs = [];
  let startIndex = 0;
  let firstPageHtml = null;

  try {
    while (true) {
      console.log(`  Fetching page starting at index ${startIndex}...`);
      const html = await fetchPage(startIndex);
      if (startIndex === 0) firstPageHtml = html;

      const pubs = parsePage(html);
      if (pubs.length === 0) break;

      allPubs = allPubs.concat(pubs);
      console.log(`  Got ${pubs.length} publications (total: ${allPubs.length})`);

      if (!hasMorePages(html) || pubs.length < 100) break;

      startIndex += 100;
      await sleep(DELAY_MS);
    }
  } catch (err) {
    if (allPubs.length === 0) {
      console.error('Failed to fetch any publications:', err.message);
      console.error('Keeping existing publications.json untouched.');
      process.exit(1);
    }
    console.warn(`Warning: stopped early after ${allPubs.length} publications: ${err.message}`);
  }

  // Get author stats from first page
  let stats = {};
  if (firstPageHtml) {
    stats = await fetchAuthorStats(firstPageHtml);
  }

  // Fetch descriptions from detail pages
  console.log(`\nFetching descriptions for ${allPubs.length} publications...`);
  for (let i = 0; i < allPubs.length; i++) {
    const pub = allPubs[i];
    if (!pub.url) { pub.description = ''; continue; }
    console.log(`  [${i + 1}/${allPubs.length}] ${pub.title.substring(0, 60)}...`);
    pub.description = await fetchDescription(pub.url);
    if (i < allPubs.length - 1) await sleep(DETAIL_DELAY_MS);
  }

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

  // Sort entries within each year by citation count descending
  for (const y of Object.keys(yearMap)) {
    yearMap[y].sort((a, b) => b.cited_by - a.cited_by);
  }

  // Build output array sorted by year descending, skip year=0
  const years = Object.keys(yearMap)
    .map(Number)
    .filter(y => y > 0)
    .sort((a, b) => b - a);

  const output = years.map(y => ({ year: y, entries: yearMap[y] }));

  // Add metadata
  const result = {
    last_updated: new Date().toISOString().split('T')[0],
    scholar_id: SCHOLAR_ID,
    scholar_url: `${BASE_URL}/citations?user=${SCHOLAR_ID}&hl=en`,
    total_publications: allPubs.filter(p => p.year > 0).length,
    ...stats,
    publications: output,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), 'utf8');

  console.log(`\nDone! Written to ${OUTPUT}`);
  console.log(`  Total publications: ${result.total_publications}`);
  console.log(`  Years: ${years[years.length - 1]} - ${years[0]}`);
  if (stats.total_citations) {
    console.log(`  Total citations: ${stats.total_citations}`);
    console.log(`  h-index: ${stats.h_index}`);
  }
  console.log(`  Last updated: ${result.last_updated}`);
}

main();
