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
} = {}) {
  const variantClass = `card-base card--${variant}`;
  const dataAttrs = attrs(
    Object.fromEntries(
      Object.entries(dataset).map(([k, v]) => [`data-${k}`, v])
    )
  );
  const imgHtml = renderCardImage(image, variant);
  const handleHtml = handle ? `<span class="grip grip--card" aria-hidden="true">${ICONS.grip}</span>` : '';
  const actionsHtml = actions
    ? `<div class="card-actions">${actions}</div>`
    : '';
  const metaHtml = meta ? `<div class="card-meta">${escapeHtml(meta)}</div>` : '';
  return `
    <article class="${variantClass}"${dataAttrs}>
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

/**
 * Centralized SVG sprite. Replaces the inline SVG copy-paste across editors.
 * All SVGs are 16x16 viewBox 0 0 20 20 unless noted; sized via CSS.
 */
export const ICONS = {
  edit: `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>`,
  delete: `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
  refresh: `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H5.498a.75.75 0 00-.75.75v3.475a.75.75 0 001.5 0v-1.324l.37.37a7 7 0 0011.722-3.138.75.75 0 00-1.442-.282zM10.47 5.05A7 7 0 003.058 8.26a.75.75 0 101.47.286 5.5 5.5 0 019.187-2.334l.31.31H11.5a.75.75 0 000 1.5h3.475a.75.75 0 00.75-.75V3.807a.75.75 0 00-1.5 0v1.324l-.354-.354A7 7 0 0010.47 5.05z" clip-rule="evenodd"/></svg>`,
  publish: `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"/><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/></svg>`,
  plus: `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`,
  close: `<svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>`,
  grip: `<svg viewBox="0 0 10 14" width="10" height="14" fill="currentColor" aria-hidden="true"><circle cx="3" cy="2" r="1.3"/><circle cx="7" cy="2" r="1.3"/><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="3" cy="12" r="1.3"/><circle cx="7" cy="12" r="1.3"/></svg>`,
  user: `<svg viewBox="0 0 20 20" fill="currentColor" width="24" height="24" aria-hidden="true"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9l4-4 4 4 4-6 4 4"/><circle cx="8" cy="14" r="2"/></svg>`,
  empty: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
};

/**
 * icon('edit') -> the SVG string. Defaults to a question mark for unknown
 * names so a typo doesn't render a broken element.
 */
export function icon(name) {
  return ICONS[name] || `<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor"/></svg>`;
}

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
