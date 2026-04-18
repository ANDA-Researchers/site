# ANDA Lab Site — Claude Code Project Rules

## Project Overview

Jekyll static site hosted on GitHub Pages at `https://anda-researchers.github.io/site`.
- `baseurl: /site` — all internal paths must be prefixed with `/site` or use `{{ site.baseurl }}`
- Admin panel at `/workspace/` (not `/admin/`) — an SPA using Supabase Auth + Edge Function proxy
- Content changes publish to `main` branch via GitHub Contents API → triggers auto-rebuild (~1-2 min)

## Directory Layout

```
_config.yml          Site config (title, email, description, baseurl)
_data/               JSON data files (team.json, projects.json, publications.json)
_layouts/            Jekyll layouts (default.html, admin.html)
_includes/           Reusable partials (header, footer, head)
_sass/               SCSS partials
assets/              CSS/JS/fonts for the public site
images/              Main image folder — profile photos, logos
images/sub/          Project & funding images (NOT assets/img/sub)
workspace/           Admin panel SPA
  admin.js           Core utilities: Supabase client, githubGetFile/Update, toast, modal, BASE
  admin.css          Admin-only styles — all UI tokens use CSS vars (--surface, --text, --accent, etc.)
  i18n.js            i18n: EN/KO/VI strings, detectBrowserLocale(), initCustomLangPicker(), applyI18n()
  index.html         Main admin SPA shell with sidebar + section switching
  login.html         Login page
  editors/
    team.js          Team CRUD editor (sections, members, alumni)
    projects.js      Projects CRUD editor
    pages.js         Markdown pages editor (about, contact, joinus, software)
    config.js        _config.yml field editor (js-yaml from CDN)
supabase/
  functions/
    github-proxy/    Edge Function: verifies JWT, proxies GitHub Contents API
    invite-user/     Sends invite email via Supabase Auth
    approve-user/    Sets profiles.status='active'
    remove-user/     Deletes member account
```

## Key Architectural Rules

### Image Paths
- Profile/logo images: `images/filename.ext` (root `images/` folder)
- Project & funding images: `images/sub/filename.ext` — **NOT** `assets/img/sub/`
- In JS, always build image src as: `${BASE}/images/...` where `BASE` comes from `admin.js` export
- The Edge Function allowlist (`github-proxy/index.ts`) must include `images/sub/` pattern

### BASE Constant
- `BASE` is exported from `workspace/admin.js`
- It reads `document.querySelector('meta[name="base-url"]')?.content`
- Always import it explicitly; never reconstruct it inline

### i18n System
- Use `data-i18n="key"` attributes on elements, call `applyI18n()` to apply translations
- Language stored in `localStorage('ws-locale')`, auto-detected from `navigator.language` on first visit
- Supported locales: `en`, `ko`, `vi`
- Use `initCustomLangPicker(pickerEl)` — NOT a native `<select>` — for the language dropdown
- The custom picker uses `[open]` attribute toggle and `.lang-opt.active` class

### Theme System
- Admin panel detects system theme via `prefers-color-scheme` on first load
- `initThemeToggle(btn, onThemeChange?)` accepts optional callback for theme-dependent UI (e.g. logo swap)
- Logos: `anda.svg` (dark text, light bg), `anda_dark.svg` (light text, dark bg)
- Theme stored in `localStorage('ws-theme')`

### Auth Flow
- Supabase email+password auth (`signInWithPassword`)
- After login, check `profiles` table: `status='active'` required; `role` is `admin` or `member`
- Session guard on every admin page: `supabase.auth.getSession()` → redirect to login if null
- Role shown in sidebar subtitle via `data-i18n="panel_admin"` or `data-i18n="panel_member"`

### Edge Function Security
- Path allowlist in `github-proxy/index.ts` — any new writable file path needs a regex added there
- After updating the Edge Function, run: `supabase functions deploy github-proxy`
- JWT verified via `${SUPABASE_URL}/auth/v1/user` endpoint
- Profile `status` checked via PostgREST with service role key (bypasses RLS)

## CSS Conventions

- All colors use CSS variables: `--text`, `--text2`, `--surface`, `--surface2`, `--border`, `--accent`
- Custom scrollbar globally in admin: `::-webkit-scrollbar { width: 5px }` + `scrollbar-width: thin`
- Upload preview areas: `position: absolute; inset: 0; object-fit: contain; background: var(--surface2)` — prevents transparent letterbox bleed-through
- Team member card images: need `transform: translateZ(0)` + `-webkit-mask-image` trick for clean border-radius antialiasing
- Tag delete buttons: must have `background: transparent` to prevent browser `ButtonFace` default in dark mode
- Modal textareas: `resize: none` to avoid resize handle clashing with custom scrollbar
- Publish bar: pill design with `border-radius: 999px; position: sticky; bottom: 1.25rem`

## Data Schemas

### `_data/team.json`
```json
{
  "sections": [
    {
      "title": "Section Name",
      "members": [
        {
          "name": "...", "role": "...", "email": "...",
          "link": "...", "bio": "...", "image": "filename.jpg",
          "research_area": ["tag1", "tag2"]
        }
      ]
    }
  ],
  "alumni": [
    { "name": "...", "role": "...", "link": "..." }
  ]
}
```

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
          "title": "...", "timeline": "...", "status": "Ongoing",
          "image": "filename.webp", "image_alt": "...",
          "funding_image": "logo.png", "funding_alt": "...", "funding_text": "...",
          "representatives": ["Name 1", "Name 2"]
        }
      ]
    }
  ]
}
```

## Page Transition Behavior

- `_layouts/default.html` uses `.page-transition` overlay that hides the page until images load
- Trigger: `window.addEventListener('load', ...)` — waits for ALL resources, not just DOM
- Images in main layout (team cards, project cards) must NOT have `loading="lazy"` so they block `window.load`
- Background/decorative images that don't affect layout shift can keep `loading="lazy"`

## Do Not Touch

- `_site/` — auto-generated by Jekyll, never edit directly
- `node_modules/` — never edit
- `Gemfile.lock` — only update via `bundle update`
- Supabase service role key or GitHub PAT must never appear in any file committed to git
