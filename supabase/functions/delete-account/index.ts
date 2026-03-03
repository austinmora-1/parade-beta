import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user with anon client
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Use service role client to delete user data and auth record
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Delete user data from tables (cascading foreign keys will handle some, but be explicit)
    const tables = [
      { table: "vibe_send_recipients", column: "recipient_id" },
      { table: "vibe_comments", column: "user_id" },
      { table: "vibe_reactions", column: "user_id" },
      { table: "vibe_sends", column: "sender_id" },
      { table: "message_reactions", column: "user_id" },
      { table: "chat_messages", column: "sender_id" },
      { table: "conversation_participants", column: "user_id" },
      { table: "plan_change_responses", column: "participant_id" },
      { table: "plan_change_requests", column: "proposed_by" },
      { table: "plan_participant_requests", column: "requested_by" },
      { table: "plan_photos", column: "uploaded_by" },
      { table: "plan_participants", column: "friend_id" },
      { table: "plan_invites", column: "invited_by" },
      { table: "plan_reminders_sent", column: "user_id" },
      { table: "plans", column: "user_id" },
      { table: "hang_requests", column: "user_id" },
      { table: "hang_requests", column: "sender_id" },
      { table: "feedback", column: "user_id" },
      { table: "availability", column: "user_id" },
      { table: "calendar_connections", column: "user_id" },
      { table: "push_subscriptions", column: "user_id" },
      { table: "friendships", column: "user_id" },
      { table: "friendships", column: "friend_user_id" },
      { table: "profiles", column: "user_id" },
    ];

    for (const { table, column } of tables) {
      await adminClient.from(table).delete().eq(column, userId);
    }

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
