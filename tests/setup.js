// Vitest setup: provide the globals admin.js expects at module-load time.
// This runs BEFORE test files are imported, so we must set globals at top
// level — not inside beforeAll, which fires after imports resolve.

// The Supabase JS SDK is normally loaded via a <script> tag on the real page;
// tests don't need a real client, just a non-throwing factory at import time.
globalThis.supabase = {
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
      signOut: async () => ({}),
      signInWithPassword: async () => ({ data: null, error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }),
      order: async () => ({ data: [] }),
    }),
  }),
};

// BASE is read from <meta name="base-url"> at module load.
if (typeof document !== 'undefined' && !document.querySelector('meta[name="base-url"]')) {
  const m = document.createElement('meta');
  m.setAttribute('name', 'base-url');
  m.setAttribute('content', '/site');
  document.head.appendChild(m);
}
