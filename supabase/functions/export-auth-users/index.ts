// One-off: dump auth.users (with password_hash) for migration to a new project.
// Auth: requires header `x-export-token` to match EXPORT_AUTH_TOKEN secret.
// Returns full pages of GoTrue admin /admin/users responses concatenated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const token = req.headers.get("x-export-token");
  const expected = Deno.env.get("EXPORT_AUTH_TOKEN");
  if (!expected || token !== expected) {
    return new Response("forbidden", { status: 403 });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const all: any[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return new Response(JSON.stringify({ error: error.message, page }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    all.push(...data.users);
    if (data.users.length < perPage) break;
    page++;
    if (page > 200) break; // safety
  }

  // listUsers strips encrypted_password. Fetch raw rows via PostgREST against auth schema is blocked,
  // so use the GoTrue admin REST endpoint directly which DOES include encrypted_password / identities.
  const rawAll: any[] = [];
  let p = 1;
  while (true) {
    const r = await fetch(`${url}/auth/v1/admin/users?page=${p}&per_page=${perPage}`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: await r.text(), page: p }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    const body = await r.json();
    const users = body.users ?? [];
    rawAll.push(...users);
    if (users.length < perPage) break;
    p++;
    if (p > 200) break;
  }

  return new Response(
    JSON.stringify({ count: rawAll.length, users: rawAll }, null, 2),
    { headers: { "content-type": "application/json" } },
  );
});
