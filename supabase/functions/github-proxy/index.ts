import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const GITHUB_PAT = Deno.env.get("GITHUB_PAT")!;
const GITHUB_REPO = "anda-researchers/site";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Member-writable paths. NOTE: SVG dropped from images/ — SVGs can carry <script>
// and execute when fetched same-origin from the published Pages site (stored XSS).
// Filename portion forbids leading dots and dot-dot to block traversal/dotfile abuse.
const ALLOWED_PATHS = [
  /^_data\/(team|projects|publications|lablife)\.json$/,
  /^_config\.yml$/,
  /^(about|contact|joinus|software)\.md$/,
  /^images\/[\w\-][\w\-\.]*\.(jpg|jpeg|png|webp|gif)$/,
  /^images\/sub\/[\w\-][\w\-\.]*\.(jpg|jpeg|png|webp|gif)$/,
  /^images\/lablife\/[\w\-][\w\-\.]*\.(jpg|jpeg|png|webp|gif)$/,
];

// Admin-only writable paths (currently none — _config.yml is member-writable).
const ADMIN_PATHS: RegExp[] = [];

// Workflow filename allowlist for dispatch/cancel (admin-only).
const ALLOWED_WORKFLOWS = new Set([
  "update-publications.yml",
]);

// Hard cap on the JSON request body to prevent abuse of the function quota.
// Base64 inflates by ~4/3, so 12 MB body ≈ 9 MB raw.
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_CONTENT_BASE64_BYTES = 11 * 1024 * 1024;

const GITHUB_HEADERS = {
  "Authorization": `token ${GITHUB_PAT}`,
  "Accept": "application/vnd.github.v3+json",
  "Content-Type": "application/json",
  "User-Agent": "ANDA-Lab-Admin/1.0",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    // 1. Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7);

    // 1. Verify JWT via Supabase Auth REST API (explicit, no SDK ambiguity)
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${token}` },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const user = await userRes.json();

    // 2. Check profile status via PostgREST with service role (bypasses RLS)
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=status,role&limit=1`,
      { headers: { "apikey": SUPABASE_SERVICE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const profiles = await profileRes.json();
    const profile = Array.isArray(profiles) ? profiles[0] : null;
    if (!profile || profile.status !== "active") {
      // Don't echo the full profile back — it's metadata leak with no caller-side use.
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Read raw body with size cap so large payloads can't burn function quota.
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    let body: Record<string, unknown>;
    try { body = JSON.parse(rawBody); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    const action = body.action as string | undefined;
    const filePath = body.path as string | undefined;
    const content = body.content as string | undefined;
    const commit_message = body.commit_message as string | undefined;

    // 3. Validate path: reject control chars / traversal, then check allowlist.
    const isWriteAction = action === "update_file";
    if (filePath !== undefined) {
      if (typeof filePath !== "string" || filePath.length === 0 || filePath.length > 256) {
        return new Response(JSON.stringify({ error: "Invalid path" }), {
          status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      // Defense in depth — the allowlist regexes already reject these, but be explicit.
      if (/[\\\x00-\x1f]/.test(filePath) || filePath.includes("..") || filePath.includes("//")) {
        return new Response(JSON.stringify({ error: "Path not allowed" }), {
          status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const memberAllowed = ALLOWED_PATHS.some((r) => r.test(filePath));
      const adminAllowed = ADMIN_PATHS.some((r) => r.test(filePath));
      if (!memberAllowed && !adminAllowed) {
        return new Response(JSON.stringify({ error: "Path not allowed" }), {
          status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      // Writes to admin-only paths require admin role.
      if (isWriteAction && adminAllowed && !memberAllowed && profile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
    }

    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;

    // GET file (returns content + sha)
    if (action === "get_file") {
      const res = await fetch(apiUrl, { headers: GITHUB_HEADERS });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // UPDATE file (PUT to GitHub)
    if (action === "update_file") {
      if (typeof content !== "string" || content.length === 0) {
        return new Response(JSON.stringify({ error: "content required" }), {
          status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      if (content.length > MAX_CONTENT_BASE64_BYTES) {
        return new Response(JSON.stringify({ error: "Content too large" }), {
          status: 413, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      // Strip control chars from commit message — prevents commit-log injection.
      const safeMessage = String(commit_message || `admin: update ${filePath}`)
        .replace(/[\r\n\x00-\x1f]/g, " ")
        .slice(0, 200);

      // Caller-supplied sha for optimistic concurrency. Otherwise look it up.
      const callerSha = typeof body.sha === "string" ? body.sha : undefined;
      let sha: string | undefined = callerSha;
      if (!sha) {
        const getRes = await fetch(apiUrl, { headers: GITHUB_HEADERS });
        if (getRes.status === 200) {
          const existing = await getRes.json();
          sha = existing.sha;
        }
      }

      const putBody: Record<string, string> = {
        message: safeMessage,
        content: content,
        branch: "main",
      };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: GITHUB_HEADERS,
        body: JSON.stringify(putBody),
      });
      const result = await putRes.json();
      return new Response(JSON.stringify(result), {
        status: putRes.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Resolve and validate workflow name once for dispatch/status.
    function resolveWorkflow(): string | null {
      const w = (body.workflow as string | undefined) || "update-publications.yml";
      return ALLOWED_WORKFLOWS.has(w) ? w : null;
    }

    // DISPATCH workflow (admin-only)
    if (action === "dispatch_workflow") {
      if (profile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const workflow = resolveWorkflow();
      if (!workflow) {
        return new Response(JSON.stringify({ error: "Workflow not allowed" }), {
          status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const refRaw = (body.ref as string | undefined) || "main";
      // Only allow simple branch names (alnum/-/_/.)
      if (!/^[\w\-./]+$/.test(refRaw) || refRaw.length > 100) {
        return new Response(JSON.stringify({ error: "Invalid ref" }), {
          status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${workflow}/dispatches`,
        { method: "POST", headers: GITHUB_HEADERS, body: JSON.stringify({ ref: refRaw }) }
      );
      // 204 = success (no content)
      return new Response(JSON.stringify({ success: res.status === 204, status: res.status }), {
        status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // GET workflow run status (any authenticated user)
    if (action === "workflow_status") {
      const workflow = resolveWorkflow();
      if (!workflow) {
        return new Response(JSON.stringify({ error: "Workflow not allowed" }), {
          status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${workflow}/runs?per_page=1`,
        { headers: GITHUB_HEADERS }
      );
      const data = await res.json();
      const run = data.workflow_runs?.[0];
      return new Response(JSON.stringify({
        run_id: run?.id ?? null,
        status: run?.status ?? null,
        conclusion: run?.conclusion ?? null,
        created_at: run?.created_at ?? null,
        updated_at: run?.updated_at ?? null,
        html_url: run?.html_url ?? null,
      }), {
        status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // CANCEL workflow run (admin-only)
    if (action === "cancel_workflow") {
      if (profile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const runId = body.run_id;
      // Only allow numeric run ids — prevents path injection on the GitHub URL.
      if (typeof runId !== "number" && !(typeof runId === "string" && /^\d+$/.test(runId))) {
        return new Response(JSON.stringify({ error: "run_id must be numeric" }), {
          status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/runs/${runId}/cancel`,
        { method: "POST", headers: GITHUB_HEADERS }
      );
      return new Response(JSON.stringify({ success: res.status === 202, status: res.status }), {
        status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Log internally for debugging but only return a generic message to the client.
    console.error("github-proxy error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
