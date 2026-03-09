import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const token = req.headers.get("Authorization")?.slice(7);
    const { data: { user }, error } = await supabase.auth.getUser(token!);
    if (error || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });

    const { data: profile } = await supabase.from("profiles").select("role, status").eq("id", user.id).single();
    if (!profile || profile.role !== "admin" || profile.status !== "active") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: CORS_HEADERS });
    }

    const { email } = await req.json();
    if (!email) return new Response(JSON.stringify({ error: "Email required" }), { status: 400, headers: CORS_HEADERS });

    const { data: newUser, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);
    if (inviteError) return new Response(JSON.stringify({ error: inviteError.message }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

    await supabase.from("profiles").insert({
      id: newUser.user.id,
      email,
      role: "member",
      status: "pending",
      invited_by: user.id,
    });

    return new Response(JSON.stringify({ success: true, email }), {
      status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS_HEADERS });
  }
});
