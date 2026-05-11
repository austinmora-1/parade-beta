// One-off: dump auth.users WITH password hashes. DELETE IMMEDIATELY AFTER USE.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (_req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Get raw auth.users rows (with encrypted_password) via SECURITY DEFINER RPC
  const { data: rawUsers, error: rpcErr } = await admin.rpc("_tmp_export_auth_users");
  if (rpcErr) {
    return new Response(JSON.stringify({ error: rpcErr.message, where: "rpc" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }

  // Also pull identities via admin REST so we have OAuth provider linkage
  const all: any[] = [];
  let p = 1;
  const perPage = 1000;
  while (true) {
    const r = await fetch(`${url}/auth/v1/admin/users?page=${p}&per_page=${perPage}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!r.ok) break;
    const body = await r.json();
    const users = body.users ?? [];
    all.push(...users);
    if (users.length < perPage) break;
    p++;
    if (p > 200) break;
  }
  const identitiesById = new Map(all.map((u: any) => [u.id, u.identities ?? []]));

  // Merge identities onto raw rows
  const merged = (rawUsers as any[]).map((u) => ({
    ...u,
    identities: identitiesById.get(u.id) ?? [],
  }));

  return new Response(JSON.stringify({ count: merged.length, users: merged }), {
    headers: { "content-type": "application/json" },
  });
});
