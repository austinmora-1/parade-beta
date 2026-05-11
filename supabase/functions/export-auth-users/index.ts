// One-off: dump auth.users for migration. DELETE IMMEDIATELY AFTER USE.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (_req) => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const all: any[] = [];
  let p = 1;
  const perPage = 1000;
  while (true) {
    const r = await fetch(`${url}/auth/v1/admin/users?page=${p}&per_page=${perPage}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!r.ok) {
      return new Response(JSON.stringify({ error: await r.text(), page: p }), {
        status: 500, headers: { "content-type": "application/json" },
      });
    }
    const body = await r.json();
    const users = body.users ?? [];
    all.push(...users);
    if (users.length < perPage) break;
    p++;
    if (p > 200) break;
  }

  return new Response(JSON.stringify({ count: all.length, users: all }), {
    headers: { "content-type": "application/json" },
  });
});
