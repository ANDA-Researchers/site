// End-to-end checks for the admin workspace. Runs against the live Jekyll
// dev server at 127.0.0.1:4000 in mock mode (localhost auto-enables).

import { test, expect } from '@playwright/test';

const WORKSPACE = '/site/workspace/';
const LOGIN = '/site/workspace/login/?stay=1';

// ── Boot + structural ─────────────────────────────────────────

test.describe('workspace boot', () => {
  test('loads with mock-mode banner visible', async ({ page }) => {
    await page.goto(WORKSPACE);
    await expect(page.locator('#ws-dev-banner')).toBeVisible();
    await expect(page.locator('#ws-dev-banner')).toContainText('MOCK');
  });

  test('all 9 sidebar nav items render with an SVG icon', async ({ page }) => {
    await page.goto(WORKSPACE);
    const navItems = page.locator('.admin-sidebar .nav-item[data-section]');
    await expect(navItems).toHaveCount(9);
    // Every nav item has at least one SVG (the Lucide icon)
    const withSvg = page.locator('.admin-sidebar .nav-item[data-section] svg');
    await expect(withSvg).toHaveCount(9);
  });

  test('topbar shows View Site, lang picker, theme toggle on desktop', async ({ page }) => {
    await page.goto(WORKSPACE);
    await expect(page.locator('.admin-topbar .btn-ghost svg')).toBeVisible(); // View Site
    await expect(page.locator('#lang-picker .lang-picker-btn svg')).toBeVisible();
    await expect(page.locator('#theme-toggle svg')).toBeVisible();
    // .btn-sidebar-toggle is correctly display:none on desktop — it appears
    // only at <=768px. Asserting it as visible here is wrong; we verify the
    // SVG is *attached* (rendered into the DOM) so the icon swap still happened.
    await expect(page.locator('.btn-sidebar-toggle svg')).toBeAttached();
  });

  test('sidebar toggle is visible at mobile viewport (<=768px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(WORKSPACE);
    await expect(page.locator('.btn-sidebar-toggle svg')).toBeVisible();
  });

  test('no legacy heroicons-mini paths leaked anywhere', async ({ page }) => {
    await page.goto(WORKSPACE);
    // Navigate through every section so each editor has rendered.
    for (const id of ['dashboard', 'team', 'projects', 'pages', 'config', 'publications', 'lablife', 'software', 'users']) {
      const item = page.locator(`.nav-item[data-section="${id}"]`);
      if (await item.count() && await item.isVisible()) await item.click();
      await page.waitForTimeout(250);
    }
    // fill-rule="evenodd" was the marker of the old Heroicons-mini path style.
    const count = await page.locator('svg[fill-rule], path[fill-rule]').count();
    expect(count, 'leftover fill-rule="evenodd" SVGs').toBe(0);
  });
});

// ── Buttons + i18n labels ─────────────────────────────────────

test.describe('button labels', () => {
  test('no doubled-plus on Add buttons (icon + text starting with "+")', async ({ page }) => {
    await page.goto(WORKSPACE);
    await page.locator('.nav-item[data-section="team"]').click();
    await page.waitForSelector('.section-block');
    // Walk every button that contains the visible text "Add" or "Invite"
    // and confirm the textContent doesn't start with "+".
    const labels = await page.locator('button:has-text("Add"), button:has-text("Invite")').evaluateAll(els =>
      els.map(e => e.textContent.trim())
    );
    for (const label of labels) {
      expect(label.startsWith('+'), `button label should not start with + (was "${label}")`).toBe(false);
    }
  });

  test('Refresh button has the SAME icon across team / projects / pages / config / lablife', async ({ page }) => {
    await page.goto(WORKSPACE);
    const refreshIds = [
      { section: 'team',     id: '#team-refresh' },
      { section: 'projects', id: '#projects-refresh' },
      { section: 'lablife',  id: '#lablife-refresh' },
      { section: 'software', id: '#software-refresh' },
      { section: 'config',   id: '#config-refresh' },
    ];
    const svgMarkers = new Set();
    for (const { section, id } of refreshIds) {
      await page.locator(`.nav-item[data-section="${section}"]`).click();
      const btn = page.locator(id);
      await btn.waitFor({ state: 'visible' });
      // Pull the first path-d attribute as a fingerprint.
      const d = await btn.locator('svg path').first().getAttribute('d');
      expect(d, `${section} refresh button is missing an icon path`).toBeTruthy();
      svgMarkers.add(d);
    }
    // All sections should converge on one icon path.
    expect(svgMarkers.size, 'refresh button uses inconsistent icons across sections').toBe(1);
  });
});

// ── Users table layout ────────────────────────────────────────

test.describe('users table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WORKSPACE);
    await page.locator('.nav-item[data-section="users"]').click();
    // Wait for the actions cell to exist — the initial render shows a
    // placeholder "Loading…" row with a single colspan=4 td, so waiting for
    // any tr would match that.
    await page.locator('.users-table td.users-actions').first().waitFor();
  });

  test('ACTIONS column header is right-aligned', async ({ page }) => {
    const th = page.locator('.users-table th').last();
    await expect(th).toHaveText('Actions');
    await expect(th).toHaveCSS('text-align', 'right');
  });

  test('Remove buttons + (you) span align to same right edge across rows', async ({ page }) => {
    const cells = page.locator('.users-table tbody tr td.users-actions');
    const count = await cells.count();
    expect(count).toBeGreaterThan(1);
    const rights = [];
    for (let i = 0; i < count; i++) {
      const box = await cells.nth(i).boundingBox();
      rights.push(box.x + box.width);
    }
    const min = Math.min(...rights);
    const max = Math.max(...rights);
    expect(max - min, `ACTIONS cells right edges drift by ${max - min}px across rows`).toBeLessThanOrEqual(2);
  });
});

// ── Drag handles visible on hover ─────────────────────────────

test.describe('drag handles', () => {
  test('team member card grip appears on hover', async ({ page }) => {
    await page.goto(WORKSPACE);
    await page.locator('.nav-item[data-section="team"]').click();
    const card = page.locator('article.card-base.card--grid').first();
    await card.waitFor();
    const grip = card.locator('.grip--card');
    await card.hover();
    // Wait for the opacity transition to settle.
    await page.waitForTimeout(300);
    const opacity = await grip.evaluate(el => parseFloat(getComputedStyle(el).opacity));
    expect(opacity, 'team card grip should be visible on hover').toBeGreaterThan(0.5);
  });

  test('project card grip appears on hover and is positioned above the image (z-index)', async ({ page }) => {
    await page.goto(WORKSPACE);
    await page.locator('.nav-item[data-section="projects"]').click();
    const card = page.locator('.project-card').first();
    await card.waitFor();
    const grip = card.locator('.grip--card');
    await card.hover();
    await page.waitForTimeout(300);
    const opacity = await grip.evaluate(el => parseFloat(getComputedStyle(el).opacity));
    expect(opacity, 'project card grip should be visible on hover').toBeGreaterThan(0.5);
    // The grip should be visually on top — z-index >= 1, or be after the image
    // in stacking order. Easier: hit-test the top-left point of the card.
    const gripBox = await grip.boundingBox();
    const hit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x + 6, y + 6);
      return el?.closest('.grip--card') ? 'grip' : el?.tagName?.toLowerCase();
    }, gripBox);
    expect(hit, 'something other than the grip is on top at the grip\'s position').toBe('grip');
  });

  test('lab life card grip appears on hover and sits on top of the photo', async ({ page }) => {
    await page.goto(WORKSPACE);
    await page.locator('.nav-item[data-section="lablife"]').click();
    const card = page.locator('.lablife-admin-card').first();
    await card.waitFor();
    const grip = card.locator('.grip--card');
    await card.hover();
    await page.waitForTimeout(300);
    const opacity = await grip.evaluate(el => parseFloat(getComputedStyle(el).opacity));
    expect(opacity, 'lab life card grip should be visible on hover').toBeGreaterThan(0.5);
    const gripBox = await grip.boundingBox();
    const hit = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x + 6, y + 6);
      return el?.closest('.grip--card') ? 'grip' : el?.tagName?.toLowerCase();
    }, gripBox);
    expect(hit, 'lab life grip is hidden behind the image (missing z-index?)').toBe('grip');
  });

  test('alumni row grip appears on hover', async ({ page }) => {
    await page.goto(WORKSPACE);
    await page.locator('.nav-item[data-section="team"]').click();
    await page.waitForSelector('.alumni-row');
    const row = page.locator('.alumni-row').first();
    await row.hover();
    await page.waitForTimeout(300);
    const opacity = await row.locator('.grip--row').evaluate(el => parseFloat(getComputedStyle(el).opacity));
    expect(opacity).toBeGreaterThan(0.5);
  });
});

// ── Drag-and-drop functional ─────────────────────────────────

test.describe('drag-and-drop reorders state', () => {
  // HTML5 native drag-and-drop. Playwright's dragTo() simulates the
  // pointer events; our handlers respond on dragstart / dragover / drop.

  test('reordering alumni updates the rendered order', async ({ page }) => {
    await page.goto(WORKSPACE);
    await page.locator('.nav-item[data-section="team"]').click();
    await page.waitForSelector('.alumni-row');
    const before = await page.locator('.alumni-row .alumni-row-name').allTextContents();
    expect(before.length).toBeGreaterThanOrEqual(3);
    const firstRow = page.locator('.alumni-row').nth(0);
    const thirdRow = page.locator('.alumni-row').nth(2);
    await firstRow.dragTo(thirdRow);
    await page.waitForTimeout(300);
    const after = await page.locator('.alumni-row .alumni-row-name').allTextContents();
    expect(after, 'alumni order should change after drag').not.toEqual(before);
    // The dragged row (formerly index 0) should have moved off the top.
    expect(after[0], 'first row should no longer be the original first').not.toBe(before[0]);
  });
});

// ── Software section ─────────────────────────────────────────

test.describe('software section', () => {
  test('loads, shows the intro + at least one card with a drag grip', async ({ page }) => {
    await page.goto(WORKSPACE);
    await page.locator('.nav-item[data-section="software"]').click();
    await page.waitForSelector('#section-software .lablife-admin-card');
    // Intro text bound to the JSON field.
    await expect(page.locator('#software-intro')).toHaveValue(/Open-source software/i);
    const cards = page.locator('#section-software .lablife-admin-card');
    expect(await cards.count()).toBeGreaterThan(0);
    // Grip becomes visible on hover (same affordance pattern as other editors).
    const first = cards.first();
    await first.hover();
    await page.waitForTimeout(200);
    const opacity = await first.locator('.grip--card').evaluate(el => parseFloat(getComputedStyle(el).opacity));
    expect(opacity).toBeGreaterThan(0.5);
  });

  test('opening the Add Software modal sets aria-modal and pre-fills year', async ({ page }) => {
    await page.goto(WORKSPACE);
    await page.locator('.nav-item[data-section="software"]').click();
    await page.locator('#software-add').click();
    const modal = page.locator('#software-modal');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    const year = await page.locator('#software-year').inputValue();
    // Default is current year; just sanity-check it's a 4-digit year.
    expect(year).toMatch(/^\d{4}$/);
  });
});

// ── Modal accessibility ──────────────────────────────────────

test.describe('modal a11y', () => {
  test('opening a modal sets role=dialog + aria-modal', async ({ page }) => {
    await page.goto(WORKSPACE);
    await page.locator('.nav-item[data-section="team"]').click();
    await page.waitForSelector('.section-block');
    // Add a member to open the modal.
    await page.locator('button[data-action="member-add"]').first().click();
    const modal = page.locator('#member-modal');
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
  });

  test('Esc closes the topmost modal only', async ({ page }) => {
    await page.goto(WORKSPACE);
    await page.locator('.nav-item[data-section="team"]').click();
    await page.locator('button[data-action="member-add"]').first().click();
    const modal = page.locator('#member-modal');
    await expect(modal).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(modal).not.toHaveClass(/open/);
  });
});

// ── i18n locale switching ────────────────────────────────────

test.describe('i18n', () => {
  test('switching to Korean updates labels in place', async ({ page }) => {
    await page.goto(WORKSPACE);
    // Open the lang picker and pick KO.
    await page.locator('#lang-picker .lang-picker-btn').click();
    await page.locator('#lang-picker .lang-opt[data-lang="ko"]').click();
    // Sidebar nav should be Korean now.
    await expect(page.locator('.nav-item[data-section="team"] span')).toHaveText('팀');
    // Switch back.
    await page.locator('#lang-picker .lang-picker-btn').click();
    await page.locator('#lang-picker .lang-opt[data-lang="en"]').click();
    await expect(page.locator('.nav-item[data-section="team"] span')).toHaveText('Team');
  });
});

// ── 404 trailing-punctuation recovery ────────────────────────

test.describe('404 trailing-punctuation recovery', () => {
  test('/site/) redirects to /site/', async ({ page }) => {
    await page.goto('/site/)');
    // Script runs on the 404 page and replaces location.
    await page.waitForURL('**/site/', { timeout: 5000 });
    expect(new URL(page.url()).pathname).toBe('/site/');
  });

  test('/site/team/. redirects to /site/team/', async ({ page }) => {
    await page.goto('/site/team/.');
    await page.waitForURL('**/site/team/', { timeout: 5000 });
    expect(new URL(page.url()).pathname).toBe('/site/team/');
  });

  test('trailing fbclid after closing paren still recovers', async ({ page }) => {
    await page.goto('/site/)?fbclid=test123');
    await page.waitForURL('**/site/?fbclid=test123', { timeout: 5000 });
    expect(new URL(page.url()).pathname).toBe('/site/');
    expect(new URL(page.url()).search).toContain('fbclid=test123');
  });

  test('a genuine 404 (no trailing punctuation) stays on the 404 page', async ({ page }) => {
    await page.goto('/site/this-page-does-not-exist');
    // No redirect — give it a moment to make sure no replace() fires.
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toBe('/site/this-page-does-not-exist');
    await expect(page.locator('.error-title')).toBeVisible();
  });
});

// ── Login screen ─────────────────────────────────────────────

test.describe('login screen', () => {
  test('renders with ?stay=1 and shows the form', async ({ page }) => {
    await page.goto(LOGIN);
    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#login-btn')).toBeVisible();
  });

  test('mock mode banner appears on login too', async ({ page }) => {
    await page.goto(LOGIN);
    await expect(page.locator('#ws-dev-banner')).toBeVisible();
  });
});
