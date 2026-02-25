import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fixed Elly virtual user ID
const ELLY_USER_ID = "00000000-0000-0000-0000-e11ye11ye11y";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_plan",
      description: "Create a new plan/event for the requesting user.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Name of the plan" },
          activity: {
            type: "string",
            enum: [
              "drinks","getting-food","coffee","events","movies","other-events",
              "me-time","reading","watching","making-food",
              "workout-in","workout-out",
              "chores","errands","shopping","doctor","flight","custom",
            ],
            description: "Activity type",
          },
          date: { type: "string", description: "ISO date string (YYYY-MM-DD)" },
          time_slot: {
            type: "string",
            enum: ["early-morning","late-morning","early-afternoon","late-afternoon","evening","late-night"],
            description: "Time slot for the plan",
          },
          duration: { type: "number", description: "Duration in minutes (default 60)" },
          location: { type: "string", description: "Location name (optional)" },
          notes: { type: "string", description: "Additional notes (optional)" },
        },
        required: ["title", "activity", "date", "time_slot"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_plan",
      description: "Update an existing plan.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "ID of the plan to update" },
          title: { type: "string" },
          activity: { type: "string" },
          date: { type: "string", description: "New ISO date (YYYY-MM-DD)" },
          time_slot: { type: "string" },
          duration: { type: "number" },
          location: { type: "string" },
          notes: { type: "string" },
        },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_plan",
      description: "Delete/cancel a plan.",
      parameters: {
        type: "object",
        properties: {
          plan_id: { type: "string", description: "ID of the plan to delete" },
        },
        required: ["plan_id"],
        additionalProperties: false,
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth client (user context)
    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client (for inserting Elly's messages)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { conversation_id, message } = await req.json();
    if (!conversation_id || !message) {
      return new Response(JSON.stringify({ error: "Missing conversation_id or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is a participant
    const { data: participation } = await supabaseUser
      .from("conversation_participants")
      .select("conversation_id")
      .eq("conversation_id", conversation_id)
      .eq("user_id", user.id)
      .single();

    if (!participation) {
      return new Response(JSON.stringify({ error: "Not a participant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recent conversation messages for context
    const { data: recentMsgs } = await supabaseUser
      .from("chat_messages")
      .select("sender_id, content, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Get participant profiles
    const { data: participants } = await supabaseUser
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversation_id);

    const participantIds = participants?.map(p => p.user_id) || [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", participantIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

    // Get user's plans for context
    const { data: userPlans } = await supabaseUser
      .from("plans")
      .select("id, title, activity, date, time_slot, duration, location, notes")
      .gte("date", new Date().toISOString())
      .order("date", { ascending: true })
      .limit(10);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().split("T")[0];
    const userName = profileMap.get(user.id) || "there";
    const participantNames = participantIds
      .filter(id => id !== user.id)
      .map(id => profileMap.get(id) || "Unknown")
      .join(", ");

    // Build conversation history for AI
    const chatHistory = (recentMsgs || []).reverse().map(m => {
      const senderName = m.sender_id === ELLY_USER_ID ? "Elly" : (profileMap.get(m.sender_id) || "Unknown");
      return { role: m.sender_id === ELLY_USER_ID ? "assistant" as const : "user" as const, content: `[${senderName}]: ${m.content}` };
    });

    const systemPrompt = `You are Elly, a friendly AI planning assistant embedded in a group/DM conversation on Parade (a social planning app). You were mentioned by a user and should help coordinate plans.

Current date: ${today}
Requesting user: ${userName}
Other participants: ${participantNames || "none"}

${userPlans?.length ? `${userName}'s upcoming plans:\n${JSON.stringify(userPlans, null, 2)}` : `${userName} has no upcoming plans.`}

Guidelines:
- Be concise, warm, and conversational — you're chatting in a group/DM thread
- Use emoji sparingly ✨
- When asked to create/update/delete plans, use the appropriate tools
- Help coordinate plans between the conversation participants
- Keep responses short since this is a chat thread
- Don't prefix your messages with "[Elly]:" — just respond naturally
- Reference participants by name when relevant
- IMPORTANT: When you create a plan, it will automatically be created for ALL participants in this conversation (not just the requester). Everyone gets the plan on their calendar. If the user specifically asks to exclude someone, mention that in the notes.
- IMPORTANT: When you successfully create, update, or delete a plan using tools, always confirm what you did in your response and mention that it's been added to everyone's calendars. For example: "Done! I've created **Dinner at Mario's** for Saturday evening for both of you 🎉" or "Got it — I've updated the time to late afternoon ✅". Be specific about what changed.`;

    // AI call
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...chatHistory,
      { role: "user", content: `[${userName}]: ${message}` },
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        tools: TOOLS,
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Elly is busy right now. Try again in a moment! 🙏" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, t);
      throw new Error("AI gateway error");
    }

    const result = await aiResponse.json();
    const choice = result.choices?.[0];
    let finalMessage = choice?.message?.content || "I'm not sure how to help with that!";
    const actions: any[] = [];

    // Handle tool calls
    if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length) {
      const toolCalls = choice.message.tool_calls;
      const toolResults: any[] = [];

      for (const tc of toolCalls) {
        const args = JSON.parse(tc.function.arguments);
        let resultContent = "";

        try {
          if (tc.function.name === "create_plan") {
            // Create plan for the requesting user
            const { data: requesterPlan, error } = await supabaseUser.from("plans").insert({
              user_id: user.id,
              title: args.title,
              activity: args.activity,
              date: new Date(args.date).toISOString(),
              time_slot: args.time_slot,
              duration: args.duration || 60,
              location: args.location || null,
              notes: args.notes || null,
            }).select().single();

            if (error) throw error;

            // Create plans for all OTHER real participants using admin client
            const otherParticipants = participantIds.filter(
              id => id !== user.id && id !== ELLY_USER_ID
            );

            const createdPlanIds: string[] = [requesterPlan.id];

            for (const pid of otherParticipants) {
              const { data: otherPlan, error: otherErr } = await supabaseAdmin.from("plans").insert({
                user_id: pid,
                title: args.title,
                activity: args.activity,
                date: new Date(args.date).toISOString(),
                time_slot: args.time_slot,
                duration: args.duration || 60,
                location: args.location || null,
                notes: args.notes || null,
                source: "elly-conversation",
              }).select("id").single();

              if (!otherErr && otherPlan) {
                createdPlanIds.push(otherPlan.id);
              }
            }

            // Cross-link all participants on each plan
            const allPlanUsers = [user.id, ...otherParticipants];
            for (const planId of createdPlanIds) {
              // Find the owner of this plan
              for (const uid of allPlanUsers) {
                // Add every OTHER user as a participant
                const isOwner = (planId === requesterPlan.id && uid === user.id) ||
                  (planId !== requesterPlan.id && uid !== user.id);
                if (!isOwner) {
                  await supabaseAdmin.from("plan_participants").insert({
                    plan_id: planId,
                    friend_id: uid,
                    status: "accepted",
                  });
                }
              }
            }

            resultContent = JSON.stringify({ success: true, plan: requesterPlan, created_for: allPlanUsers.length });
            actions.push({ type: "create_plan", args });
          } else if (tc.function.name === "update_plan") {
            const updates: any = {};
            if (args.title) updates.title = args.title;
            if (args.activity) updates.activity = args.activity;
            if (args.date) updates.date = new Date(args.date).toISOString();
            if (args.time_slot) updates.time_slot = args.time_slot;
            if (args.duration) updates.duration = args.duration;
            if (args.location !== undefined) updates.location = args.location;
            if (args.notes !== undefined) updates.notes = args.notes;

            const { error } = await supabaseUser.from("plans").update(updates).eq("id", args.plan_id).eq("user_id", user.id);
            if (error) throw error;
            resultContent = JSON.stringify({ success: true });
            actions.push({ type: "update_plan", args });
          } else if (tc.function.name === "delete_plan") {
            const { error } = await supabaseUser.from("plans").delete().eq("id", args.plan_id).eq("user_id", user.id);
            if (error) throw error;
            resultContent = JSON.stringify({ success: true });
            actions.push({ type: "delete_plan", args });
          }
        } catch (e: any) {
          resultContent = JSON.stringify({ error: e.message });
        }

        toolResults.push({ role: "tool", tool_call_id: tc.id, content: resultContent });
      }

      // Follow-up AI call with tool results
      const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [...aiMessages, choice.message, ...toolResults],
          stream: false,
        }),
      });

      if (followUp.ok) {
        const followUpResult = await followUp.json();
        finalMessage = followUpResult.choices?.[0]?.message?.content || "Done! ✅";
      }
    }

    // Insert Elly's response into the conversation using service role (bypasses RLS)
    const { error: insertError } = await supabaseAdmin.from("chat_messages").insert({
      conversation_id,
      sender_id: ELLY_USER_ID,
      content: finalMessage,
    });

    if (insertError) {
      console.error("Failed to insert Elly message:", insertError);
    }

    return new Response(JSON.stringify({
      message: finalMessage,
      actions,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("elly-conversation-assist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Something went wrong" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
