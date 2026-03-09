#!/usr/bin/env node
// ============================================================
// ANDA Lab Admin — Automated Setup Script
// Run: node scripts/admin-setup.js
// ============================================================

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');

const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));
const log = (msg) => console.log(msg);
const ok = (msg) => console.log(`${GREEN}✓${RESET} ${msg}`);
const warn = (msg) => console.log(`${YELLOW}⚠${RESET}  ${msg}`);
const err = (msg) => console.log(`${RED}✗${RESET} ${msg}`);
const step = (n, msg) => console.log(`\n${BOLD}${CYAN}[${n}]${RESET} ${BOLD}${msg}${RESET}`);

function httpsPost(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = { hostname: parsed.hostname, port: 443, path: parsed.pathname + parsed.search, method: 'GET', headers };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPatch(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname, port: 443,
      path: parsed.pathname + parsed.search, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function runSetup() {
  console.clear();
  console.log(`${BOLD}${CYAN}
╔════════════════════════════════════════════╗
║      ANDA Lab Admin Setup Wizard           ║
╚════════════════════════════════════════════╝${RESET}`);
  console.log(`\nThis script sets up everything automatically.\nYou only need 4 values from your browser.\n`);

  // ── Step 1: Collect credentials ──────────────────────────
  step(1, 'Supabase credentials');
  log(`
Open ${CYAN}https://supabase.com${RESET} and:
  1. Create a free account + new project (choose any region)
  2. Go to ${BOLD}Project Settings → API${RESET}
  3. Copy the following values:
`);

  const supabaseUrl = (await ask(`  ${BOLD}Project URL${RESET} (https://xxxx.supabase.co): `)).trim().replace(/\/$/, '');
  const anonKey = (await ask(`  ${BOLD}anon / public key${RESET}: `)).trim();
  const serviceKey = (await ask(`  ${BOLD}service_role key${RESET} (secret): `)).trim();

  if (!supabaseUrl.startsWith('https://') || !anonKey || !serviceKey) {
    err('Invalid credentials. Please check and re-run.');
    process.exit(1);
  }

  // Extract project ref from URL
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
  ok(`Project ref: ${projectRef}`);

  // ── Step 2: GitHub PAT ────────────────────────────────────
  step(2, 'GitHub Personal Access Token');
  log(`
Open this URL in your browser:
${CYAN}https://github.com/settings/personal-access-tokens/new${RESET}

Settings:
  - Token name: ANDA Lab Admin
  - Expiration: 1 year (or No expiration)
  - Repository access: ${BOLD}Only select repositories${RESET} → anda-researchers/site
  - Permissions: ${BOLD}Contents → Read and Write${RESET}

Click "Generate token" and copy it.
`);
  const githubPat = (await ask(`  ${BOLD}GitHub PAT${RESET} (ghp_xxx…): `)).trim();
  if (!githubPat.startsWith('ghp_') && !githubPat.startsWith('github_pat_')) {
    warn('Token format looks unusual but continuing…');
  }

  // ── Step 3: Admin account ─────────────────────────────────
  step(3, 'Admin account');
  log(`\nCreate your admin login credentials:\n`);
  const adminEmail = (await ask(`  ${BOLD}Admin email${RESET}: `)).trim();
  const adminPassword = (await ask(`  ${BOLD}Admin password${RESET} (min 8 chars): `)).trim();

  if (adminPassword.length < 8) { err('Password must be at least 8 characters.'); process.exit(1); }

  log('\n' + '─'.repeat(50));
  log(`${BOLD}Summary:${RESET}`);
  log(`  Supabase:   ${supabaseUrl}`);
  log(`  GitHub PAT: ${githubPat.slice(0,12)}…`);
  log(`  Admin:      ${adminEmail}`);
  log('─'.repeat(50));
  const proceed = (await ask(`\nProceed? (y/N): `)).trim().toLowerCase();
  if (proceed !== 'y') { log('Cancelled.'); process.exit(0); }

  // ── Step 4: Apply SQL schema ──────────────────────────────
  step(4, 'Applying database schema…');
  const schema = fs.readFileSync(path.join(ROOT, 'supabase/schema.sql'), 'utf8')
    .split('\n').filter(l => !l.trim().startsWith('--') && l.trim()).join('\n')
    .replace(/-- INSERT.*[\s\S]*$/, ''); // Remove commented INSERT block

  const schemaRes = await httpsPost(
    `${supabaseUrl}/rest/v1/rpc/exec_sql`,
    { query: schema },
    { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  );

  // Try alternative endpoint if rpc doesn't work
  if (schemaRes.status !== 200) {
    // Use Supabase Management API
    const mgmtRes = await httpsPost(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      { query: schema },
      { Authorization: `Bearer ${serviceKey}` }
    );
    if (mgmtRes.status !== 200 && mgmtRes.status !== 201) {
      warn('Could not auto-apply schema via API. You will need to run supabase/schema.sql manually in the Supabase SQL Editor.');
      warn('Go to: Dashboard → SQL Editor → paste the contents of supabase/schema.sql → Run');
    } else { ok('Schema applied'); }
  } else { ok('Schema applied'); }

  // ── Step 5: Configure Auth settings via Management API ────
  step(5, 'Configuring auth settings…');
  const authConfigRes = await httpsPatch(
    `https://api.supabase.com/v1/projects/${projectRef}/config/auth`,
    {
      site_url: 'https://anda-researchers.github.io/site',
      uri_allow_list: 'https://anda-researchers.github.io/site/admin/',
      disable_signup: true,
      mailer_autoconfirm: false,
      minimum_password_length: 8,
    },
    { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
  );
  if (authConfigRes.status === 200 || authConfigRes.status === 204) {
    ok('Auth settings configured');
  } else {
    warn('Could not auto-configure auth. Set manually: Auth → Settings → disable signups, set site URL');
  }

  // ── Step 6: Create admin user ─────────────────────────────
  step(6, 'Creating admin user account…');
  const createUserRes = await httpsPost(
    `${supabaseUrl}/auth/v1/admin/users`,
    { email: adminEmail, password: adminPassword, email_confirm: true },
    { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  );

  if (createUserRes.status !== 200 && createUserRes.status !== 201) {
    err('Failed to create admin user: ' + JSON.stringify(createUserRes.data));
    process.exit(1);
  }
  const adminUserId = createUserRes.data.id;
  ok(`Admin user created: ${adminUserId}`);

  // ── Step 7: Insert admin profile ──────────────────────────
  step(7, 'Setting up admin profile…');
  const profileRes = await httpsPost(
    `${supabaseUrl}/rest/v1/profiles`,
    { id: adminUserId, email: adminEmail, role: 'admin', status: 'active' },
    { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: 'return=minimal' }
  );
  if (profileRes.status === 201 || profileRes.status === 200) {
    ok('Admin profile created');
  } else {
    warn('Profile may need manual insertion. Run in SQL Editor:');
    warn(`INSERT INTO public.profiles (id, email, role, status) VALUES ('${adminUserId}', '${adminEmail}', 'admin', 'active');`);
  }

  // ── Step 8: Deploy Edge Functions via CLI ─────────────────
  step(8, 'Deploying Edge Functions…');
  let cliAvailable = false;
  try {
    execSync('supabase --version', { stdio: 'ignore' });
    cliAvailable = true;
  } catch {}

  if (cliAvailable) {
    try {
      log('  Linking project…');
      execSync(`supabase link --project-ref ${projectRef}`, { cwd: ROOT, stdio: 'inherit' });
      log('  Setting GitHub PAT secret…');
      execSync(`supabase secrets set GITHUB_PAT="${githubPat}"`, { cwd: ROOT, stdio: 'inherit' });
      log('  Deploying functions…');
      ['github-proxy', 'invite-user', 'approve-user', 'remove-user'].forEach(fn => {
        execSync(`supabase functions deploy ${fn} --no-verify-jwt`, { cwd: ROOT, stdio: 'inherit' });
        ok(`Deployed: ${fn}`);
      });
    } catch (e) {
      warn('CLI deployment failed. See manual steps below.');
      cliAvailable = false;
    }
  }

  if (!cliAvailable) {
    log(`\n${YELLOW}Supabase CLI not found. Install it and run these commands:${RESET}`);
    log(`  npm install -g supabase`);
    log(`  cd ${ROOT}`);
    log(`  supabase login`);
    log(`  supabase link --project-ref ${projectRef}`);
    log(`  supabase secrets set GITHUB_PAT="${githubPat}"`);
    ['github-proxy', 'invite-user', 'approve-user', 'remove-user'].forEach(fn => {
      log(`  supabase functions deploy ${fn} --no-verify-jwt`);
    });
  }

  // ── Step 9: Inject credentials into admin files ───────────
  step(9, 'Updating admin files with credentials…');

  const filesToPatch = [
    path.join(ROOT, 'admin/login.html'),
    path.join(ROOT, 'admin/admin.js'),
  ];

  filesToPatch.forEach((file) => {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/YOUR_SUPABASE_URL/g, supabaseUrl);
    content = content.replace(/YOUR_SUPABASE_ANON_KEY/g, anonKey);
    fs.writeFileSync(file, content);
    ok(`Patched: ${path.relative(ROOT, file)}`);
  });

  // ── Done ──────────────────────────────────────────────────
  console.log(`\n${BOLD}${GREEN}
╔════════════════════════════════════════════╗
║           Setup Complete! 🎉               ║
╚════════════════════════════════════════════╝${RESET}

${BOLD}Your admin panel:${RESET}
  Local:  http://localhost:4000/site/admin/login/
  Live:   https://anda-researchers.github.io/site/admin/login/

${BOLD}Login with:${RESET}
  Email:    ${adminEmail}
  Password: (the one you just set)

${BOLD}Next steps:${RESET}
  1. Commit & push these changes to GitHub
  2. Wait ~2 min for GitHub Pages to rebuild
  3. Visit the admin login page
  4. Done!
`);

  if (!cliAvailable) {
    log(`${YELLOW}${BOLD}⚠ Don't forget to deploy the Edge Functions (step 8 above)${RESET}`);
  }

  rl.close();
}

runSetup().catch((e) => { err(e.message); process.exit(1); });
