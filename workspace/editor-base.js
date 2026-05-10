// ============================================================
// Editor controller — replaces the dirty-tracking / refresh / publish /
// `window._foo` / sha-forwarding boilerplate that every editor copies.
//
//   const ctrl = createEditor({
//     sectionId: 'section-team',
//     filePath: '_data/team.json',
//     defaultData: { sections: [], alumni: [] },
//     parse: (raw) => JSON.parse(raw),
//     serialize: (data) => JSON.stringify(data, null, 2),
//     render: (data, ctrl) => { … },
//     commitMsg: 'admin: update team data',
//     successMsg: 'Team published! Site rebuilds in ~1-2 min.',
//   });
//   await ctrl.reload();
//   ctrl.bindActions(rootEl, {
//     'add-member': (e, args) => { … },
//     'edit-member': (e, args) => { … },
//   });
//
// Wires in:
//   • dirty tracking + per-editor publish-button state
//   • refresh-with-discard prompt
//   • optimistic-concurrency `sha` forwarding
//   • event delegation via [data-action] attributes (replaces window._*)
//   • single shared beforeunload registry (warns on tab close)
// ============================================================

import {
  githubGetFile,
  githubUpdateFile,
  decodeGithubContent,
  toast,
  confirm,
  t,
} from './admin.js';

// ── Shared dirty registry (one global beforeunload handler) ─────
const dirtyRegistry = new Set();
let beforeUnloadInstalled = false;

function ensureBeforeUnload() {
  if (beforeUnloadInstalled) return;
  beforeUnloadInstalled = true;
  window.addEventListener('beforeunload', (event) => {
    if (dirtyRegistry.size === 0) return;
    // Modern browsers ignore the custom message but the prompt still fires
    // when preventDefault() is called or returnValue is set.
    event.preventDefault();
    event.returnValue = t('dirty_warn') || 'You have unsaved changes.';
    return event.returnValue;
  });
}

/**
 * Parse `data-args` as JSON if present, else return undefined.
 * Use the JSON form when the action takes structured args:
 *   <button data-action="edit" data-args='[0, 2]'>
 */
function parseActionArgs(el) {
  const raw = el.dataset.args;
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

export function createEditor(opts) {
  const {
    sectionId,
    filePath,
    defaultData = null,
    parse = (raw) => JSON.parse(raw),
    serialize = (data) => JSON.stringify(data, null, 2),
    render,
    commitMsg = `admin: update ${opts.filePath || ''}`,
    successMsg = 'Published! Site rebuilds in ~1-2 min.',
    publishBtnId = `${(opts.filePath || '').replace(/\W/g, '-')}-publish`,
    refreshBtnId,
  } = opts;

  if (!filePath) throw new Error('createEditor: filePath is required');
  if (typeof render !== 'function') throw new Error('createEditor: render(data, ctrl) is required');

  ensureBeforeUnload();

  let data = defaultData ? structuredClone(defaultData) : null;
  let sha = null;
  let dirty = false;
  const registryKey = Symbol(filePath);
  const actionHandlers = new Map();

  function publishBtn() { return document.getElementById(publishBtnId); }

  function setDirty(flag) {
    dirty = flag;
    const btn = publishBtn();
    if (btn) btn.disabled = !flag;
    if (flag) dirtyRegistry.add(registryKey);
    else dirtyRegistry.delete(registryKey);
  }

  async function reload({ confirmIfDirty = true } = {}) {
    if (confirmIfDirty && dirty) {
      const ok = await confirm(t('dirty_warn') || 'Discard unsaved changes?', {
        confirmKey: 'btn_discard',
        variant: 'ghost',
      });
      if (!ok) return false;
    }
    try {
      const file = await githubGetFile(filePath);
      sha = file?.sha || null;
      const raw = file ? decodeGithubContent(file.content) : null;
      data = raw ? parse(raw) : (defaultData ? structuredClone(defaultData) : null);
      setDirty(false);
      render(data, controller);
      return true;
    } catch (err) {
      toast(`Failed to load ${filePath}: ${err.message}`, 'error');
      return false;
    }
  }

  async function publish() {
    if (!dirty) return;
    const btn = publishBtn();
    const origHTML = btn ? btn.innerHTML : null;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span data-i18n="publishing">${t('publishing')}</span>`;
    }
    try {
      const result = await githubUpdateFile(filePath, serialize(data), commitMsg, sha);
      if (result?.content?.sha) sha = result.content.sha;
      setDirty(false);
      if (btn && origHTML) btn.innerHTML = origHTML;
      toast(successMsg, 'success');
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        if (origHTML) btn.innerHTML = origHTML;
      }
      toast(`Publish failed: ${err.message}`, 'error');
    }
  }

  /**
   * Wire event delegation on the root element. Targets any element with
   * [data-action="<key>"]; the matching handler receives (event, args, el)
   * where args is parsed from data-args (JSON) if present.
   *
   *   ctrl.bindActions(root, {
   *     'edit-member': (e, [si, mi]) => openEditor(si, mi),
   *     'add-section': () => addSection(),
   *   });
   */
  function bindActions(root, handlers) {
    if (!root || !handlers) return;
    Object.entries(handlers).forEach(([k, fn]) => actionHandlers.set(k, fn));
    if (root.__editorBaseDelegated) return; // already wired this root
    root.__editorBaseDelegated = true;
    root.addEventListener('click', (event) => {
      const el = event.target.closest('[data-action]');
      if (!el || !root.contains(el)) return;
      const action = el.dataset.action;
      const handler = actionHandlers.get(action);
      if (!handler) return;
      const args = parseActionArgs(el);
      handler(event, args, el);
    });
  }

  function attachRefreshButton() {
    const id = refreshBtnId;
    if (!id) return;
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => reload());
  }

  function attachPublishButton() {
    const btn = publishBtn();
    if (!btn) return;
    btn.addEventListener('click', publish);
  }

  const controller = {
    reload,
    publish,
    bindActions,
    attachRefreshButton,
    attachPublishButton,
    markDirty: () => setDirty(true),
    clearDirty: () => setDirty(false),
    isDirty: () => dirty,
    getData: () => data,
    setData: (next) => { data = next; setDirty(true); render(data, controller); },
    /** Schedule a re-render without marking dirty (e.g. after locale change). */
    rerender: () => render(data, controller),
  };
  return controller;
}

// Test hook — let the unit suite force-clear the registry between cases.
export function _resetDirtyRegistryForTests() {
  dirtyRegistry.clear();
}
