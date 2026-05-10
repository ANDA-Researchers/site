// ============================================================
// Single drag/drop image upload helper.
//
// Replaces the three duplicated implementations in team / projects /
// lablife editors and the dead `initImageUpload` that was in admin.js.
//
//   const handle = attachUpload(area, {
//     pathPrefix: 'images/sub',
//     preview: previewImg,
//     hiddenField: filenameInput,
//     fileInput: existingInput,    // optional — uses existing <input type=file>
//     onUploaded: (filename) => { ... }
//   });
//   // later, if the editor re-renders the area:
//   handle.destroy();
//
// Sanitizes the filename, disables click+drop while uploading, and writes
// the final filename into the hidden field on success. The on-screen
// preview shows immediately via FileReader (data URL) regardless of upload
// outcome, so users see feedback even if the network is slow.
// ============================================================

import {
  githubUploadImage,
  sanitizeFilename,
  toast,
  BASE,
} from './admin.js';

const SAFE_FOLDER = /^[a-zA-Z0-9_\-/]+$/;

/**
 * Wire a drop-zone element with click + dragover + drop + file-input.
 * Returns { destroy() } so editors can tear down on re-render.
 */
export function attachUpload(area, opts = {}) {
  if (!area) return { destroy() {} };
  const {
    pathPrefix,
    preview = null,
    hiddenField = null,
    fileInput = null,
    onUploaded,
  } = opts;

  if (!pathPrefix || !SAFE_FOLDER.test(pathPrefix)) {
    throw new Error('attachUpload: pathPrefix is required and must match [a-zA-Z0-9_\\-/]+');
  }

  // Use the caller-supplied <input type=file> if present, else create one.
  const input = fileInput || (() => {
    const el = document.createElement('input');
    el.type = 'file';
    el.accept = 'image/*';
    el.style.display = 'none';
    area.appendChild(el);
    return el;
  })();
  if (!input.accept) input.accept = 'image/*';

  let busy = false;
  const setBusy = (state) => {
    busy = state;
    area.style.opacity = state ? '0.5' : '';
    area.style.pointerEvents = state ? 'none' : '';
    input.disabled = state;
  };

  const handlers = {
    click: (e) => {
      // The click that came from the file input itself shouldn't re-trigger.
      if (busy || e.target === input) return;
      input.click();
    },
    dragover: (e) => { e.preventDefault(); area.classList.add('dragover'); },
    dragleave: () => area.classList.remove('dragover'),
    drop: async (e) => {
      e.preventDefault();
      area.classList.remove('dragover');
      if (busy) return;
      const file = e.dataTransfer.files[0];
      if (file) await handleFile(file);
    },
    change: async () => {
      if (busy) return;
      const file = input.files && input.files[0];
      if (file) await handleFile(file);
    },
  };

  area.addEventListener('click', handlers.click);
  area.addEventListener('dragover', handlers.dragover);
  area.addEventListener('dragleave', handlers.dragleave);
  area.addEventListener('drop', handlers.drop);
  input.addEventListener('change', handlers.change);

  async function handleFile(file) {
    // Show the preview immediately via FileReader so the UI is responsive
    // regardless of how long the upload takes.
    if (preview) {
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        preview.classList.add('shown');
      };
      reader.readAsDataURL(file);
    }
    const safeName = sanitizeFilename(file.name);
    const path = pathPrefix.replace(/\/$/, '') + '/' + safeName;
    setBusy(true);
    try {
      await githubUploadImage(path, file);
      if (hiddenField) hiddenField.value = safeName;
      toast('Image uploaded', 'success');
      if (onUploaded) onUploaded(safeName, path);
    } catch (err) {
      toast('Upload failed: ' + err.message, 'error');
    } finally {
      setBusy(false);
      // Clear the file input so re-uploading the same file fires `change`.
      input.value = '';
    }
  }

  return {
    destroy() {
      area.removeEventListener('click', handlers.click);
      area.removeEventListener('dragover', handlers.dragover);
      area.removeEventListener('dragleave', handlers.dragleave);
      area.removeEventListener('drop', handlers.drop);
      input.removeEventListener('change', handlers.change);
      if (!fileInput && input.parentNode) input.parentNode.removeChild(input);
    },
  };
}

/**
 * Set the preview image src to BASE + '/' + pathPrefix + '/' + encoded name.
 * Or hide the preview if filename is empty.
 *   setUploadPreview(previewImg, 'kbui.webp', 'images')
 */
export function setUploadPreview(preview, filename, pathPrefix) {
  if (!preview) return;
  if (!filename) {
    preview.style.display = 'none';
    preview.classList.remove('shown');
    preview.src = '';
    return;
  }
  preview.src = `${BASE}/${pathPrefix.replace(/\/$/, '')}/${encodeURIComponent(filename)}`;
  preview.style.display = 'block';
  preview.classList.add('shown');
}
