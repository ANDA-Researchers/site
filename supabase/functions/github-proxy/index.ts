import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GITHUB_PAT = Deno.env.get("GITHUB_PAT")!;
const GITHUB_REPO = "anda-researchers/site";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_PATHS = [
  /^_data\/(team|projects|publications)\.json$/,
  /^_config\.yml$/,
  /^(about|contact|joinus|software)\.md$/,
  /^images\/[\w\-\.]+\.(jpg|jpeg|png|webp|svg|gif)$/,
  /^assets\/img\/sub\/[\w\-\.]+\.(jpg|jpeg|png|webp|gif)$/,
];

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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // 2. Check profile status
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, role")
      .eq("id", user.id)
      .single();
    if (!profile || profile.status !== "active") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, path: filePath, content, commit_message } = body;

    // 3. Validate path allowlist
    if (filePath && !ALLOWED_PATHS.some((r) => r.test(filePath))) {
      return new Response(JSON.stringify({ error: "Path not allowed" }), {
        status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
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
      // Get current sha
      const getRes = await fetch(apiUrl, { headers: GITHUB_HEADERS });
      let sha: string | undefined;
      if (getRes.status === 200) {
        const existing = await getRes.json();
        sha = existing.sha;
      }

      const putBody: Record<string, string> = {
        message: commit_message || `admin: update ${filePath}`,
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

    // DISPATCH workflow (admin-only)
    if (action === "dispatch_workflow") {
      if (profile.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }
      const workflow = body.workflow || "update-publications.yml";
      const ref = body.ref || "main";
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${workflow}/dispatches`,
        { method: "POST", headers: GITHUB_HEADERS, body: JSON.stringify({ ref }) }
      );
      // 204 = success (no content)
      return new Response(JSON.stringify({ success: res.status === 204, status: res.status }), {
        status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
