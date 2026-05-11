// ============================================================
// Workspace UI primitives — escape-by-default template helpers.
//
// Every public function returns an HTML string (or builds DOM safely).
// Every text path goes through escapeHtml; every URL through safeUrl.
// Labels emit data-i18n="key" so applyI18n() drives translation; never
// resolve t(key) at call time (it'd be overwritten on the next locale change).
//
// Editors should compose these into bigger templates rather than hand-rolling
// `<div class="field"><label>${...}</label>...</div>` blocks.
// ============================================================

import { escapeHtml, safeUrl, BASE } from './admin.js';

// ── Internal helpers ─────────────────────────────────────────

const ATTR_NAME = /^[a-zA-Z_:][\w:.\-]*$/;

/**
 * Serialize a plain object into a safe attribute string.
 *   attrs({ id: 'x', 'data-action': 'edit', disabled: true })
 *     -> 'id="x" data-action="edit" disabled'
 * Boolean true emits the bare attribute; false / null / undefined skips it.
 * Attribute names are validated against a conservative pattern; values escaped.
 */
export function attrs(obj) {
  if (!obj) return '';
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === false || v === null || v === undefined) continue;
    if (!ATTR_NAME.test(k)) continue;
    if (v === true) { parts.push(k); continue; }
    parts.push(`${k}="${escapeHtml(v)}"`);
  }
  return parts.length ? ' ' + parts.join(' ') : '';
}

// ── Card ─────────────────────────────────────────────────────

/**
 * Unified card surface used by team / projects / lab life listings.
 *
 *   card({
 *     image: { src: '/site/images/me.webp', alt: 'Photo of …' } | null,
 *     title: 'Display name',         // escaped
 *     subtitle: 'Role / position',   // escaped
 *     meta: 'Optional third line',   // escaped
 *     actions: '<button …>',         // CALLER-TRUSTED HTML
 *     variant: 'grid' | 'flex' | 'media',
 *     dataset: { si: 0, mi: 1 },     // becomes data-si="0" data-mi="1"
 *     handle: true,                  // shows a drag grip in the corner
 *   })
 *
 * Returns an HTML string. The `actions` slot is the only place pre-built HTML
 * is accepted — document this at every call site.
 */
export function card({
  image = null,
  title = '',
  subtitle = '',
  meta = '',
  actions = '',
  variant = 'grid',
  dataset = {},
  handle = false,
  draggable = false,
} = {}) {
  const variantClass = `card-base card--${variant}`;
  const dataAttrs = attrs(
    Object.fromEntries(
      Object.entries(dataset).map(([k, v]) => [`data-${k}`, v])
    )
  );
  const dragAttr = draggable ? ' draggable="true"' : '';
  const imgHtml = renderCardImage(image, variant);
  const handleHtml = handle ? `<span class="grip grip--card" aria-hidden="true" data-grip>${ICONS.grip}</span>` : '';
  const actionsHtml = actions
    ? `<div class="card-actions">${actions}</div>`
    : '';
  const metaHtml = meta ? `<div class="card-meta">${escapeHtml(meta)}</div>` : '';
  return `
    <article class="${variantClass}"${dataAttrs}${dragAttr}>
      ${handleHtml}
      ${imgHtml}
      <div class="card-body">
        <div class="card-title">${escapeHtml(title) || '—'}</div>
        ${subtitle ? `<div class="card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        ${metaHtml}
      </div>
      ${actionsHtml}
    </article>`;
}

function renderCardImage(image, variant) {
  if (!image || !image.src) {
    if (variant === 'media') {
      return `<div class="card-image card-image--placeholder" aria-hidden="true">${ICONS.image}</div>`;
    }
    if (variant === 'grid') {
      return `<div class="card-image card-image--placeholder" aria-hidden="true">${ICONS.user}</div>`;
    }
    return '';
  }
  const src = safeUrl(image.src);
  const alt = escapeHtml(image.alt || '');
  return `<img class="card-image" src="${src}" alt="${alt}" loading="lazy" onerror="this.style.display='none'">`;
}

// ── Form field ───────────────────────────────────────────────

/**
 * A labeled form input. The label emits data-i18n so applyI18n() drives
 * locale changes; never call t() here.
 *
 *   field({
 *     id: 'member-name',
 *     labelKey: 'f_name',           // data-i18n key
 *     labelFallback: 'Name',        // shown until applyI18n runs
 *     type: 'text',                 // or 'email', 'url', 'textarea', 'select'
 *     value: '...',
 *     placeholder: '...',
 *     required: true,
 *     hint: 'Optional helper text',
 *     options: [{value, labelKey}], // for type='select'
 *   })
 */
export function field({
  id,
  labelKey,
  labelFallback,
  type = 'text',
  value = '',
  placeholder = '',
  required = false,
  hint,
  attrs: extra = {},
  options,
} = {}) {
  const labelHtml = labelKey
    ? `<label for="${escapeHtml(id)}" data-i18n="${escapeHtml(labelKey)}">${escapeHtml(labelFallback ?? labelKey)}</label>`
    : labelFallback
      ? `<label for="${escapeHtml(id)}">${escapeHtml(labelFallback)}</label>`
      : '';
  const placeholderAttr = placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : '';
  const requiredAttr = required ? ' required' : '';
  const extraAttrs = attrs(extra);
  let inputHtml = '';
  if (type === 'textarea') {
    inputHtml = `<textarea id="${escapeHtml(id)}"${placeholderAttr}${requiredAttr}${extraAttrs}>${escapeHtml(value)}</textarea>`;
  } else if (type === 'select') {
    const optsHtml = (options || []).map(opt => {
      const sel = opt.value === value ? ' selected' : '';
      const labelI18n = opt.labelKey ? ` data-i18n="${escapeHtml(opt.labelKey)}"` : '';
      const text = escapeHtml(opt.labelFallback ?? opt.labelKey ?? opt.value);
      return `<option value="${escapeHtml(opt.value)}"${sel}${labelI18n}>${text}</option>`;
    }).join('');
    inputHtml = `<select id="${escapeHtml(id)}"${requiredAttr}${extraAttrs}>${optsHtml}</select>`;
  } else {
    inputHtml = `<input type="${escapeHtml(type)}" id="${escapeHtml(id)}" value="${escapeHtml(value)}"${placeholderAttr}${requiredAttr}${extraAttrs}>`;
  }
  const hintHtml = hint
    ? `<div class="field-hint" data-i18n="${escapeHtml(hint)}">${escapeHtml(hint)}</div>`
    : '';
  return `<div class="field">${labelHtml}${inputHtml}${hintHtml}</div>`;
}

// ── Section header ───────────────────────────────────────────

/**
 * The repeated "title + description + refresh button" header used at the top
 * of every editor.
 *
 *   sectionHeader({
 *     titleKey: 'team_title',
 *     descKey: 'team_desc',
 *     actions: '<button …>'   // CALLER-TRUSTED, optional
 *   })
 */
export function sectionHeader({
  titleKey,
  titleFallback,
  descKey,
  descFallback,
  actions = '',
} = {}) {
  const titleAttr = titleKey ? ` data-i18n="${escapeHtml(titleKey)}"` : '';
  const descAttr = descKey ? ` data-i18n="${escapeHtml(descKey)}"` : '';
  return `
    <header class="section-header">
      <div class="section-header-text">
        <h2 class="section-title"${titleAttr}>${escapeHtml(titleFallback ?? titleKey ?? '')}</h2>
        ${descKey || descFallback ? `<p class="section-desc"${descAttr}>${escapeHtml(descFallback ?? descKey ?? '')}</p>` : ''}
      </div>
      ${actions ? `<div class="section-header-actions">${actions}</div>` : ''}
    </header>`;
}

// ── Publish bar ──────────────────────────────────────────────

/**
 * The sticky-bottom save/publish pill used by every editor.
 *
 *   publishBar({ btnId: 'team-publish' })
 */
export function publishBar({
  btnId,
  btnKey = 'publish_btn',
  btnFallback = 'Publish Changes',
  hintKey = 'publish_hint',
  hintFallback = 'Changes are saved locally until you publish',
} = {}) {
  return `
    <div class="publish-bar">
      <span class="publish-bar-hint" data-i18n="${escapeHtml(hintKey)}">${escapeHtml(hintFallback)}</span>
      <button class="btn btn-accent" id="${escapeHtml(btnId)}" disabled>
        ${ICONS.publish}
        <span data-i18n="${escapeHtml(btnKey)}">${escapeHtml(btnFallback)}</span>
      </button>
    </div>`;
}

// ── Empty state ──────────────────────────────────────────────

export function emptyState({
  iconSvg = ICONS.empty,
  messageKey,
  messageFallback = 'Nothing here yet.',
  action = '',
} = {}) {
  const msgAttr = messageKey ? ` data-i18n="${escapeHtml(messageKey)}"` : '';
  return `
    <div class="empty-state">
      ${iconSvg}
      <p${msgAttr}>${escapeHtml(messageFallback)}</p>
      ${action}
    </div>`;
}

// ── Icon library ─────────────────────────────────────────────
//
// Verified verbatim Lucide v0.474.0 paths (https://lucide.dev).
// Single source of truth: every icon in the workspace SHOULD come from
// icon(name) below, not hand-drawn inline SVG. Index.html and editors
// that still have inline SVGs are getting migrated to use icon() too.
//
// 24x24 viewBox, stroke="currentColor", stroke-width 2, line-cap/join
// "round" — gives a clean, consistent line everywhere. Width/height
// default to the natural icon size; CSS in .btn handles button sizing.

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

// Internal: returns just the path data for a given Lucide icon name.
// Callers should use icon(name) for the wrapped <svg> string. Exporting
// PATHS too so HTML files (login.html, index.html) that emit static
// SVGs can reference the same source.
export const LUCIDE_PATHS = {
  // edit (pen — Lucide "pen-line")
  edit: `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/><path d="m15 5 3 3"/>`,
  // trash-2
  delete: `<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>`,
  // rotate-cw
  refresh: `<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>`,
  // upload
  publish: `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>`,
  // plus
  plus: `<path d="M5 12h14"/><path d="M12 5v14"/>`,
  // x
  close: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`,
  // grip-vertical
  grip: `<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>`,
  // user-round
  user: `<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>`,
  // image
  image: `<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>`,
  // search-x — empty state
  empty: `<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="m8.5 8.5 5 5"/><path d="m8.5 13.5 5-5"/>`,
  // triangle-alert
  warning: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
  // check
  check: `<path d="M20 6 9 17l-5-5"/>`,
  // refresh-ccw (animated "syncing" variant)
  sync: `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>`,
  // log-out
  signOut: `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>`,
  // eye — view site
  eye: `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>`,
  // chevron-down — picker
  chevronDown: `<path d="m6 9 6 6 6-6"/>`,
  // moon — theme toggle
  moon: `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`,
  // sun — theme toggle (light)
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>`,
  // panel-left-open — sidebar toggle (mobile)
  panelLeft: `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/>`,
  // layout-dashboard — dashboard nav
  dashboard: `<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>`,
  // users — team nav
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  // briefcase — projects nav
  briefcase: `<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
  // file-text — pages nav
  fileText: `<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>`,
  // settings — config nav
  settings: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
  // book-open-text — publications nav
  bookOpen: `<path d="M12 7v14"/><path d="M16 12h2"/><path d="M16 8h2"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/><path d="M6 12h2"/><path d="M6 8h2"/>`,
  // camera — lab life nav
  camera: `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>`,
  // shield-check — users-management nav
  shield: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>`,
};

/**
 * Build a wrapped <svg> string for a Lucide icon. Width/height default
 * to 16 for inline buttons; pass overrides for big placeholders.
 *
 *   icon('refresh')                 // 16x16
 *   icon('image', { size: 32 })     // 32x32
 *   icon('empty', { width: 40, height: 40 })
 */
export function icon(name, opts = {}) {
  const path = LUCIDE_PATHS[name];
  if (!path) {
    // Fallback so a typo doesn't break the layout.
    return `<svg viewBox="0 0 24 24" width="14" height="14" ${STROKE} aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>`;
  }
  const size = opts.size ?? null;
  const w = opts.width ?? size ?? 16;
  const h = opts.height ?? size ?? 16;
  return `<svg viewBox="0 0 24 24" width="${w}" height="${h}" ${STROKE} aria-hidden="true">${path}</svg>`;
}

// Back-compat: ICONS.<name> still works for editors that reference it.
export const ICONS = new Proxy({}, {
  get(_target, name) { return icon(name); },
});

/**
 * icon('edit') -> the SVG string. Defaults to a question mark for unknown
// ── Image src builder ────────────────────────────────────────

/**
 * Build a safe image src under the workspace's image folders.
 *   imageSrc('images', 'photo.jpg') -> '/site/images/photo.jpg' (URL-encoded)
 * Returns '' if filename is empty.
 */
export function imageSrc(pathPrefix, filename) {
  if (!filename) return '';
  return `${BASE}/${pathPrefix}/${encodeURIComponent(filename)}`;
}
