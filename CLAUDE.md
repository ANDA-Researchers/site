# ANDA Lab Site — Claude Code Project Rules

## Project Overview

Jekyll static site hosted on GitHub Pages at `https://anda-researchers.github.io/site`.
- `baseurl: /site` — all internal paths must be prefixed with `/site` or use `{{ site.baseurl }}`
- Admin panel at `/workspace/` (not `/admin/`) — an SPA using Supabase Auth + Edge Function proxy
- Content changes publish to `main` branch via GitHub Contents API → triggers auto-rebuild (~1-2 min)
- Vitest suite at `tests/`. Run with `npm test` before claiming a refactor is safe.

## Past traps (READ THIS FIRST)

These are non-obvious decisions that look like bugs but are deliberate. Don't "fix" them without checking with the maintainer.

- **`research_area` is a string, NOT an array.** A previous attempt to migrate to `["tag1", "tag2"]` was deliberately ditched. The data is comma-separated strings, the editor (`workspace/editors/team.js`) saves a string, and `team.md` renders `{{ member.research_area }}` directly. The editor's `openMemberModal` *reads* both shapes for backward compatibility, but `saveMember` writes a string. Don't touch.
- **`projects.json` does NOT have `image_alt` / `funding_alt` populated** despite the editor having UI for them. `projects.md` falls back to `project.title` and `'Funding logo'` so the alt text is never empty. Don't depend on the alt fields being present.
- **`6H Next Generation Mobile Communications`** is a real project name (active project), not a typo for 6G. The completed `6G Mobile Core Network` project is separate.
- **`autoRefreshToken: true`** in the Supabase client is intentional — long edit sessions used to die at the JWT TTL when this was `false`. Keep it on.
- **`_config.yml` lists only the GH-Pages-supported plugins.** `jekyll-spaceship` is in the `Gemfile` for local previews but intentionally absent from `plugins:` because GH Pages ignores it anyway.

## Directory Layout

```
_config.yml                    Site config (title, email, description, baseurl)
_data/                         JSON data files
  team.json                    Members + alumni (research_area is a string!)
  projects.json                Active + completed research projects
  publications.json            Auto-synced from Google Scholar (do not hand-edit)
  lablife.json                 Gallery entries
_layouts/                      Jekyll layouts (default.html, page.html, workspace.html, …)
_includes/                     Reusable partials (head.html, header.html, footer.html, …)
_sass/                         SCSS partials
assets/                        CSS/JS/fonts for the public site
images/                        Profile photos, logos
images/sub/                    Project & funding images (NOT assets/img/sub/)
images/lablife/                Gallery photos
workspace/                     Admin panel SPA (ES modules, no build step)
  admin.js                     Supabase client, githubGetFile/Update/UploadImage,
                               toast, modal, BASE, escapeHtml, safeUrl,
                               sanitizeFilename, initThemeToggle
  admin.css                    Admin-only styles — all UI tokens use CSS vars
  i18n.js                      EN/KO/VI strings, detectBrowserLocale,
                               initCustomLangPicker, applyI18n
  index.html                   Main admin SPA shell (sidebar + section switching)
  login.html                   Login page
  editors/
    team.js                    Team CRUD (sections / members / alumni)
    projects.js                Projects CRUD
    pages.js                   Markdown pages (about, contact, joinus) — NOT software,
                               which has its own structured editor below
    publications.js            Workflow trigger + recent-pubs preview
    config.js                  _config.yml field editor
    lablife.js                 Lab Life gallery CRUD
    software.js                Software list CRUD (drives _data/software.json
                               + the software.md Liquid template)
supabase/
  functions/
    github-proxy/              Edge Function: verifies JWT, proxies GitHub Contents API
    invite-user/               Sends invite email via Supabase Auth
    approve-user/              Sets profiles.status='active'
    remove-user/               Deletes member account
tests/                         Vitest suite (excluded from _site/)
.github/workflows/
  update-publications.yml      Weekly Google Scholar sync (concurrency-guarded)
```

## Key Architectural Rules

### Editor render security (load-bearing)

Every editor renders user-controlled JSON via `innerHTML` template strings. Untrusted strings MUST go through `escapeHtml()`; URLs MUST go through `safeUrl()` (which filters `javascript:`/`data:`/`vbscript:`). Both are exported from `workspace/admin.js`. Image filenames must be `encodeURIComponent`'d before being interpolated into `src="…"`. New filename uploads must run through `sanitizeFilename()`.

The threat model is privilege escalation: any active member can write hostile JSON; if an admin then loads the panel, any unescaped sink runs in the admin's authenticated session. Tests in `tests/xss-regression.test.js` lock this down — keep them green.

### Image Paths
- Profile/logo images: `images/filename.ext` (root `images/` folder)
- Project & funding images: `images/sub/filename.ext` — **NOT** `assets/img/sub/`
- Lab Life gallery: `images/lablife/filename.ext`
- In JS, always build image src as `${BASE}/images/...` (or `images/sub/`, `images/lablife/`) where `BASE` comes from `admin.js`. Pass the filename through `encodeURIComponent` so weird characters can't break out of the `src` attribute.
- The Edge Function allowlist (`github-proxy/index.ts`) must include the path pattern for any new writable directory. **SVG is intentionally excluded** from the upload allowlist — SVGs can carry `<script>` and execute when fetched same-origin.

### BASE Constant
- `BASE` is exported from `workspace/admin.js` and reads `document.querySelector('meta[name="base-url"]')?.content`.
- Both `workspace/index.html` and the public `_includes/head.html` emit the meta tag; any module-loaded script can rely on it.
- Always import it explicitly; never reconstruct it inline.

### i18n System
- Use `data-i18n="key"` attributes on elements, call `applyI18n()` to apply translations
- Language stored in `localStorage('ws-locale')`, auto-detected from `navigator.language` on first visit
- Supported locales: `en`, `ko`, `vi`. **All three locale tables must contain the same keys.** A test in `tests/i18n.test.js` enforces this.
- Use `initCustomLangPicker(pickerEl)` — NOT a native `<select>` — for the language dropdown
- The custom picker uses `[open]` attribute toggle and `.lang-opt.active` class

### Theme System
- Admin panel detects system theme via `prefers-color-scheme` on first load
- `initThemeToggle(btn, onThemeChange?)` accepts optional callback for theme-dependent UI (e.g. logo swap)
- Logos: `anda.svg` (dark text, light bg), `anda_dark.svg` (light text, dark bg)
- Theme stored in `localStorage('theme')` (NOT `'ws-theme'` — the storage key is `'theme'` set in `_includes/head.html`'s flash-prevention script and reused by `admin.js`)

### Auth Flow
- Supabase email+password auth (`signInWithPassword`)
- After login, check `profiles` table: `status='active'` required; `role` is `admin` or `member`
- Session guard on every admin page: `supabase.auth.getSession()` → redirect to login if null
- Role shown in sidebar subtitle via `data-i18n="panel_admin"` or `data-i18n="panel_member"`
- Health-check pre-flight (`SUPABASE_URL/auth/v1/health` with `apikey` header, 4 s `AbortController` timeout) decides whether to even create the SDK client. Use `resetBackendReachableCache()` if a stale negative result needs to be cleared in-page.
- `autoRefreshToken: true` keeps long edit sessions alive past the 1 h JWT TTL.

### Edge Function Security
- Path allowlist in `github-proxy/index.ts` — any new writable file path needs a regex added there. Filenames must start with `[\w\-]` (no leading dots, no traversal).
- **Auto-deploy** via `.github/workflows/deploy-supabase-functions.yml` — push to `main` with changes under `supabase/functions/**` and the workflow deploys all four functions to the linked project (`xarrinotiwofnyzrmdow`). Needs the `SUPABASE_ACCESS_TOKEN` repo secret (generate at https://supabase.com/dashboard/account/tokens). Also runnable on demand from the Actions tab.
- For local testing or feature-branch deploys, run manually: `supabase functions deploy <name> --project-ref xarrinotiwofnyzrmdow`.
- JWT verified via `${SUPABASE_URL}/auth/v1/user` endpoint
- Profile `status` checked via PostgREST with service role key (bypasses RLS). The 403 response does NOT echo the profile back (info leak).
- Body capped at 12 MB, base64 content at 11 MB. Commit messages stripped of control chars.
- Workflow `dispatch_workflow` / `workflow_status` / `cancel_workflow` only accept filenames in `ALLOWED_WORKFLOWS` and numeric `run_id`s.
- Optimistic concurrency: callers can pass `sha` to `update_file` and the proxy forwards it to GitHub. Editors capture `sha` on load and forward it on publish so concurrent edits don't silently overwrite.
- `_config.yml` is member-writable (intentional — keep this open unless explicitly asked to restrict).

## CSS Conventions

- All colors use CSS variables: `--text`, `--text2`, `--surface`, `--surface2`, `--border`, `--accent`
- Custom scrollbar globally in admin: `::-webkit-scrollbar { width: 5px }` + `scrollbar-width: thin`
- Upload preview areas: `position: absolute; inset: 0; object-fit: contain; background: var(--surface2)` — prevents transparent letterbox bleed-through
- Team member card images: need `transform: translateZ(0)` + `-webkit-mask-image` trick for clean border-radius antialiasing
- Tag delete buttons: must have `background: transparent` to prevent browser `ButtonFace` default in dark mode
- Modal textareas: `resize: none` to avoid resize handle clashing with custom scrollbar
- Publish bar: pill design with `border-radius: 999px; position: sticky; bottom: 1.25rem`

## Data Schemas (active, not aspirational)

### `_data/team.json`
```json
{
  "sections": [
    {
      "title": "Section Name",
      "members": [
        {
          "name": "...",
          "role": "...",
          "email": "...",
          "link": "...",
          "bio": "...",
          "image": "filename.jpg",
          "research_area": "comma, separated, string"
        }
      ]
    }
  ],
  "alumni": [
    { "name": "...", "role": "...", "link": "..." }
  ]
}
```
Notes:
- `research_area` is a STRING, not an array. See "Past traps" above.
- All member fields except `name` and `role` are optional.

### `_data/projects.json`
```json
{
  "intro": "...",
  "collaborationCta": "...",
  "sections": [
    {
      "title": "Section Name",
      "projects": [
        {
          "title": "...",
          "timeline": "...",
          "status": "Ongoing",
          "image": "filename.webp",
          "funding_image": "logo.png",
          "funding_text": "Funded by …",
          "representatives": ["Name 1", "Name 2"]
        }
      ]
    }
  ]
}
```
Notes:
- `image_alt` / `funding_alt` exist as fields the editor can save but are NOT populated in the current data. `projects.md` falls back to `project.title` / `'Funding logo'` so don't worry if they're absent.
- `representatives` is an array of plain name strings.

### `_data/lablife.json`
```json
{
  "entries": [
    {
      "title": "...",
      "date": "YYYY-MM-DD",
      "description": "...",
      "cover": "filename.webp"
    }
  ]
}
```
Cover photos live at `images/lablife/`.

### `_data/software.json`
```json
{
  "intro": "Optional intro paragraph",
  "items": [
    {
      "title": "Instance Embedding LPS",
      "year": 2024,
      "link": "https://…",
      "image": "filename.webp",
      "image_alt": "Demo of …",
      "description": "Optional short description"
    }
  ]
}
```
Demo images/GIFs live at `images/software/`. `software.md` is a Liquid template iterating over `site.data.software.items` — don't hand-edit it as raw markdown.

### `_data/publications.json`
Auto-synced from Google Scholar by `.github/workflows/update-publications.yml` (runs Sunday 03:00 UTC, also dispatchable from the admin panel). Don't hand-edit; it'll be overwritten.

## Page Transition Behavior

- `_layouts/default.html` uses `.page-transition` overlay that hides the page until images load
- Trigger: `window.addEventListener('load', ...)` waits for ALL resources, NOT just DOM
- A `setTimeout(reveal, 3000)` fallback guarantees the overlay clears even if a CDN script (GSAP / Three.js / `.glb` model) stalls. Don't remove this — it's the difference between "slow page" and "permanently blanked page."
- Images in main layout (team cards, project cards) must NOT have `loading="lazy"` so they block `window.load`
- Background/decorative images that don't affect layout shift can keep `loading="lazy"`

## Testing

- `npm test` runs the Vitest suite under jsdom (~2 s).
- `tests/setup.js` stubs the global `supabase` SDK and a `<meta name="base-url">` so admin.js imports cleanly.
- New work touching escape helpers, the path allowlist, the i18n table, or `_data/*.json` schemas should add or update a test alongside.

## Do Not Touch

- `_site/` — auto-generated by Jekyll, never edit directly
- `node_modules/` / `vendor/` — never edit
- `Gemfile.lock` — only update via `bundle update`
- `_data/publications.json` — auto-synced, hand edits will be overwritten
- Supabase service role key, GitHub PAT, or any other secret — must never appear in any file committed to git
