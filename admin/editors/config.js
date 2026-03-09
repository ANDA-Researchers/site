import { githubGetFile, githubUpdateFile, decodeGithubContent, toast } from '../admin.js';

let configRaw = '';
const EDITABLE_FIELDS = [
  { key: 'title', label: 'Site Title', type: 'text' },
  { key: 'email', label: 'Contact Email', type: 'email' },
  { key: 'description', label: 'Site Description', type: 'textarea' },
  { key: 'location', label: 'Location', type: 'textarea' },
];

export async function initConfigEditor() {
  const section = document.getElementById('section-config');
  section.innerHTML = `
    <div class="section-header">
      <div>
        <div class="section-title">Site Config</div>
        <div class="section-desc">Edit core site settings (_config.yml)</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="config-refresh">↺ Refresh</button>
    </div>
    <div class="alert alert-warning" style="margin-bottom:1rem">Changes here trigger a full site rebuild. Title and description changes may take 2-3 minutes to appear.</div>
    <div id="config-fields" class="card"><div class="loader-spinner" style="margin:0 auto"></div></div>
    <div style="display:flex;justify-content:flex-end;margin-top:1rem">
      <button class="btn btn-accent" id="config-publish">⬇ Publish Config</button>
    </div>`;

  document.getElementById('config-refresh').addEventListener('click', loadConfig);
  document.getElementById('config-publish').addEventListener('click', publishConfig);
  await loadConfig();
}

async function loadConfig() {
  try {
    const file = await githubGetFile('_config.yml');
    configRaw = decodeGithubContent(file.content);
    renderFields();
  } catch (err) {
    document.getElementById('config-fields').innerHTML = `<div class="alert alert-warning">Failed to load: ${err.message}</div>`;
  }
}

function getYamlValue(yaml, key) {
  // Simple single-line value extraction
  const match = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  if (!match) return '';
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

function setYamlValue(yaml, key, value) {
  // Replace a simple key: value line (handles single/double-line values)
  const escaped = value.replace(/\n/g, '\\n');
  const newLine = value.includes('\n') ? `${key}: "${value.replace(/"/g, '\\"')}"` : `${key}: ${value}`;
  if (yaml.match(new RegExp(`^${key}:`, 'm'))) {
    return yaml.replace(new RegExp(`^${key}:.*$`, 'm'), newLine);
  }
  return yaml + `\n${newLine}`;
}

function renderFields() {
  const container = document.getElementById('config-fields');
  container.style.padding = '1.25rem';
  let html = '';
  EDITABLE_FIELDS.forEach(f => {
    const val = getYamlValue(configRaw, f.key);
    if (f.type === 'textarea') {
      html += `<div class="field"><label>${f.label}</label><textarea id="cfg-${f.key}" style="width:100%;padding:0.6rem 0.85rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);min-height:60px;resize:vertical;font-family:var(--font);font-size:0.85rem">${val}</textarea></div>`;
    } else {
      html += `<div class="field"><label>${f.label}</label><input type="${f.type}" id="cfg-${f.key}" value="${val.replace(/"/g, '&quot;')}" style="width:100%;padding:0.6rem 0.85rem;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text)"></div>`;
    }
  });
  container.innerHTML = html;
}

async function publishConfig() {
  let updatedYaml = configRaw;
  EDITABLE_FIELDS.forEach(f => {
    const el = document.getElementById('cfg-' + f.key);
    if (el) updatedYaml = setYamlValue(updatedYaml, f.key, el.value.trim());
  });

  const btn = document.getElementById('config-publish');
  btn.disabled = true; btn.textContent = 'Publishing…';
  try {
    await githubUpdateFile('_config.yml', updatedYaml, 'admin: update site config');
    configRaw = updatedYaml;
    toast('Config published! Full site rebuild in ~2-3 min.', 'success');
  } catch (err) { toast('Publish failed: ' + err.message, 'error'); }
  btn.disabled = false; btn.textContent = '⬇ Publish Config';
}
