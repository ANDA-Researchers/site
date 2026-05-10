// ============================================================
// Workspace dev mode — local-only mock of Supabase + GitHub proxy.
//
// Activated automatically on localhost / 127.0.0.1, or via ?mock=1 anywhere.
// Disable on localhost with ?live=1.
// Switch role with ?role=member (default: admin).
//
// All "writes" go to sessionStorage under WS_MOCK_KEY so reloads in the
// same tab preserve your edits. Open a new tab or close this one to reset.
// ============================================================

const params = new URLSearchParams(location.search);
const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
export const IS_DEV_MODE =
  params.has('mock') || (isLocal && !params.has('live'));

export const MOCK_ROLE = params.get('role') === 'member' ? 'member' : 'admin';
const MOCK_USER = { id: 'mock-uid-0001', email: 'you@local.dev' };

const SESSION_KEY = 'ws-mock-overlay-v1';
function loadOverlay() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}'); }
  catch { return {}; }
}
function saveOverlay(o) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(o)); } catch {}
}

// ── Fixture data — small but exercises every UI state ─────────
const TEAM = {
  sections: [
    {
      title: 'Professor',
      members: [
        {
          name: 'Prof. Myungsik Yoo',
          role: 'Professor and Lab Director',
          email: 'myoo@ssu.ac.kr',
          image: 'myoo.webp',
          link: 'https://scholar.google.com/citations?user=TARMZOsAAAAJ&hl=ko',
          bio: 'Prof. Myungsik Yoo received the B.S. and M.S. degrees in electrical engineering from Korea University, and the Ph.D. from the State University of New York at Buffalo. He is currently a full-time professor at the School of Electronic Engineering, Soongsil University.',
        },
      ],
    },
    {
      title: 'Students',
      members: [
        {
          name: 'Mock PhD Student',
          role: 'PhD Student',
          email: 'phd@local.dev',
          link: 'https://example.com',
          image: 'DSC_1767_2.png',
          research_area: 'LiDAR Panoptic Segmentation, World model.',
        },
        {
          name: 'Mock Master Student',
          role: 'Master Student',
          email: 'ms@local.dev',
          image: 'thinh.webp',
          research_area: 'Semi-supervised Learning',
        },
        {
          name: 'Mock Intern',
          role: 'Intern',
          image: 'istockphoto-2171382633-612x612.jpg',
          research_area: 'Machine Learning',
        },
      ],
    },
  ],
  alumni: [
    {
      name: 'Dr. Mock Alumnus',
      link: 'https://example.com/alumnus',
      role: 'Senior Researcher at Mock Corp, Seoul',
    },
    { name: 'Dr. No-Link Alumnus', role: 'Lecturer at Some University' },
    { name: 'Plain Alumnus' },
  ],
};

const PROJECTS = {
  intro:
    'Our research lab is involved in innovative projects across autonomous driving, intelligent networks, and edge computing. Below are the active and completed projects currently highlighted on the site.',
  collaborationCta:
    "If you're interested in collaborating on any of these projects or exploring new research directions,",
  sections: [
    {
      title: 'Active Projects',
      projects: [
        {
          title: 'Mock active project — autonomous edge cooperation',
          timeline: '2024-2028',
          status: 'Ongoing',
          representatives: ['Mock Researcher A', 'Mock Researcher B'],
          image: 'ap1.webp',
          funding_image: 'nrf.webp',
          funding_text: 'Funded by NRF-MSIT (RS-MOCK-0001).',
        },
        {
          title: 'Mock active project — 6H mobile communications',
          timeline: '2021-2028',
          status: 'Ongoing',
          representatives: ['Mock Researcher B'],
          image: 'ap1.webp',
          funding_image: 'download.jpg',
          funding_text: 'Funded by IITP (IITP-MOCK-0002).',
        },
      ],
    },
    {
      title: 'Completed Projects',
      projects: [
        {
          title: 'Mock completed project — 6G mobile core network',
          timeline: 'Completed',
          status: 'Ended',
          representatives: ['Mock Researcher B'],
          image: 'ap1.webp',
          funding_image: 'nrf.webp',
          funding_text: 'Funded by NRF-MSIT (RS-MOCK-0003).',
        },
      ],
    },
  ],
};

const LABLIFE = {
  entries: [
    {
      title: '2026 Lab Spring Outing',
      date: '2026-03-15',
      cover: 'cover.webp',
      description: 'Mock entry — annual lab spring outing in Seoul.',
    },
    { title: '2025 Conference Trip', date: '2025-11-02' },
  ],
};

const PUBLICATIONS = {
  h_index: 24,
  total_citations: 1842,
  publications: [
    {
      year: 2026,
      entries: [
        {
          title: 'Mock paper — LiDAR panoptic segmentation under domain shift',
          venue: 'CVPR (Mock)',
          citation: 'Mock Author et al., CVPR 2026 - 12 pages',
          year: 2026,
          cited_by: 8,
          url: 'https://example.com/mock-paper-1',
        },
      ],
    },
    {
      year: 2025,
      entries: [
        {
          title: 'Mock paper — semi-supervised 3D scene completion',
          venue: 'ICCV (Mock)',
          citation: 'Mock Author et al., ICCV 2025',
          year: 2025,
          cited_by: 31,
        },
      ],
    },
  ],
};

const PAGES_MD = {
  'about.md': '---\nlayout: page\ntitle: About\npermalink: /about/\n---\n\n# About (mock)\n\nThis is mock about-page content. Edit me to test the markdown editor.\n\n## Subsection\n\n- Item one\n- Item two\n- Item three\n',
  'contact.md': '---\nlayout: page\ntitle: Contact\npermalink: /contact/\n---\n\n# Contact (mock)\n\nMock contact info. Click **Preview** to see the rendered HTML.\n',
  'joinus.md': '---\nlayout: page\ntitle: Join Us\npermalink: /joinus/\n---\n\n# Join Us (mock)\n\nMock recruiting copy. Visit [our website](https://example.com).\n',
  'software.md': '---\nlayout: page\ntitle: Software\npermalink: /software/\n---\n\n# Software (mock)\n\nMock software listing.\n',
};

const CONFIG_YML = `title: ANDA Lab (Mock)
baseurl: /site
url: https://anda-researchers.github.io
base_path: /site
lang: en
email: mock@local.dev
author: ANDA Lab
description: AI-Driven Network and Data Analytics Lab — mock copy you can edit safely.
location: Mock location, Seoul, Korea
logo: /images/anda.svg
image: /images/cover.webp
header_pages:
  - about.md
  - team.md
  - projects.md
  - publications.md
  - software.md
  - lablife.md
  - contact.md
  - joinus.md
`;

const PROFILES = [
  { id: 'mock-uid-0001', email: 'you@local.dev', role: MOCK_ROLE, status: 'active', created_at: '2026-01-01T00:00:00Z' },
  { id: 'mock-uid-0002', email: 'admin2@local.dev', role: 'admin', status: 'active', created_at: '2026-01-02T00:00:00Z' },
  { id: 'mock-uid-0003', email: 'member@local.dev', role: 'member', status: 'active', created_at: '2026-02-15T00:00:00Z' },
  { id: 'mock-uid-0004', email: 'pending@local.dev', role: 'member', status: 'pending', created_at: '2026-04-30T00:00:00Z' },
];

// Path → fixture lookup. Returned in the GitHub Contents API shape so admin.js's
// decodeGithubContent + JSON.parse works unchanged.
function fixtureFor(path) {
  if (path === '_data/team.json') return JSON.stringify(TEAM, null, 2);
  if (path === '_data/projects.json') return JSON.stringify(PROJECTS, null, 2);
  if (path === '_data/lablife.json') return JSON.stringify(LABLIFE, null, 2);
  if (path === '_data/publications.json') return JSON.stringify(PUBLICATIONS, null, 2);
  if (path === '_config.yml') return CONFIG_YML;
  if (PAGES_MD[path]) return PAGES_MD[path];
  return null;
}

function utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

// ── Mock GitHub proxy ─────────────────────────────────────────
export async function mockGithubGetFile(path) {
  await tick();
  const overlay = loadOverlay();
  const stored = overlay[path];
  if (stored) return stored;
  const raw = fixtureFor(path);
  if (raw === null) return null; // 404 — file doesn't exist
  return {
    content: utf8ToBase64(raw),
    sha: 'mock-sha-' + hashCode(raw),
    path,
  };
}

export async function mockGithubUpdateFile(path, contentStr, _msg, _sha) {
  await tick(150);
  const overlay = loadOverlay();
  const newSha = 'mock-sha-' + Date.now().toString(36);
  overlay[path] = {
    content: utf8ToBase64(contentStr),
    sha: newSha,
    path,
  };
  saveOverlay(overlay);
  return { content: { sha: newSha, path } };
}

export async function mockGithubUploadImage(path, _file) {
  await tick(200);
  // Note: we don't actually persist the bytes — the on-screen preview is a
  // FileReader data URL, so the UX is intact. The next page load will fall
  // through to the real /images/ path (which 404s for new uploads — fine
  // for design audits).
  const overlay = loadOverlay();
  overlay[path] = { content: '', sha: 'mock-sha-img-' + Date.now(), path };
  saveOverlay(overlay);
  return { content: { sha: overlay[path].sha, path } };
}

export async function mockEdgeCall(fn, body) {
  await tick(150);
  if (fn === 'github-proxy') {
    if (body?.action === 'workflow_status') {
      return {
        run_id: null,
        status: null,
        conclusion: null,
        created_at: null,
        updated_at: null,
        html_url: null,
      };
    }
    if (body?.action === 'dispatch_workflow') {
      return { success: true, status: 204 };
    }
    if (body?.action === 'cancel_workflow') {
      return { success: true, status: 202 };
    }
  }
  if (fn === 'invite-user') return { ok: true };
  if (fn === 'approve-user') return { ok: true };
  if (fn === 'remove-user') return { ok: true };
  return { ok: true, mock: true };
}

// ── Mock Supabase client ──────────────────────────────────────
export function makeMockSupabaseClient() {
  const session = {
    user: MOCK_USER,
    access_token: 'mock-jwt-token',
  };

  function profilesQuery() {
    return {
      eq: (col, val) => ({
        single: async () => {
          await tick();
          const found = PROFILES.find(p => p[col] === val);
          if (found) return { data: found, error: null };
          // First-load case: signed-in user; return as the active mock role.
          return {
            data: { id: val, email: MOCK_USER.email, role: MOCK_ROLE, status: 'active' },
            error: null,
          };
        },
      }),
      order: async () => {
        await tick();
        return { data: PROFILES, error: null };
      },
    };
  }

  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      getUser: async () => ({ data: { user: MOCK_USER } }),
      signOut: async () => ({}),
      signInWithPassword: async ({ email }) => {
        await tick(300);
        return { data: { user: { ...MOCK_USER, email: email || MOCK_USER.email } }, error: null };
      },
    },
    from: (table) => ({
      select: () => {
        if (table === 'profiles') return profilesQuery();
        return {
          eq: () => ({ single: async () => ({ data: null }) }),
          order: async () => ({ data: [] }),
        };
      },
    }),
  };
}

// ── Visible banner so you always know you're in mock mode ────
export function injectDevBanner() {
  if (!IS_DEV_MODE || document.getElementById('ws-dev-banner')) return;
  const bar = document.createElement('div');
  bar.id = 'ws-dev-banner';
  bar.textContent = `MOCK · ${MOCK_ROLE} · sessionStorage-backed (no remote writes)`;
  Object.assign(bar.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '99998',
    padding: '4px 12px',
    background: 'repeating-linear-gradient(45deg,#fbbf24,#fbbf24 10px,#f59e0b 10px,#f59e0b 20px)',
    color: '#1f2937',
    fontFamily: 'system-ui,sans-serif',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.05em',
    textAlign: 'center',
    pointerEvents: 'none',
    textShadow: '0 1px 0 rgba(255,255,255,0.6)',
  });
  document.body.appendChild(bar);
  // Push the rest of the page down a little so the banner doesn't overlap.
  document.documentElement.style.scrollPaddingTop = '24px';
  if (!document.getElementById('ws-dev-banner-pad')) {
    const style = document.createElement('style');
    style.id = 'ws-dev-banner-pad';
    style.textContent = 'body { padding-top: 22px; }';
    document.head.appendChild(style);
  }
}

// ── Internal helpers ─────────────────────────────────────────
function tick(ms = 80) {
  return new Promise(r => setTimeout(r, ms));
}
function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
