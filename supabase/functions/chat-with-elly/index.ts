import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_plan",
      description:
        "Create a new plan/event for the user. Use this when they want to schedule something.",
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
      description: "Update an existing plan. Use when the user wants to reschedule or modify a plan.",
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

    // Verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build system prompt with user context
    const today = new Date().toISOString().split("T")[0];
    const systemPrompt = `You are Elly, a friendly and enthusiastic AI assistant for Parade — a social planning app. You help users manage their plans, check availability, and coordinate with friends.

Current date: ${today}
User's name: ${context?.userName || "there"}

${context?.plans?.length ? `User's upcoming plans:\n${JSON.stringify(context.plans, null, 2)}` : "User has no upcoming plans."}

${context?.friends?.length ? `User's friends: ${context.friends.map((f: any) => f.name).join(", ")}` : "User has no friends connected yet."}

${context?.availability?.length ? `User's availability this week:\n${JSON.stringify(context.availability, null, 2)}` : ""}

Guidelines:
- Be concise, warm, and use emoji sparingly ✨
- When the user wants to create a plan, use the create_plan tool
- When the user wants to change/reschedule a plan, use the update_plan tool  
- When the user wants to cancel a plan, use the delete_plan tool
- For availability questions, reference the context provided
- Suggest plans based on friend availability and user preferences
- Always confirm actions with the user after executing them
- Use casual, friendly language — you're their social planning buddy`;

    // First AI call (may include tool calls)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools: TOOLS,
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Elly is a bit busy right now. Try again in a moment! 🙏" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits needed. Please add funds to continue chatting with Elly." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, t);
      throw new Error("AI gateway error");
    }

    const result = await aiResponse.json();
    const choice = result.choices?.[0];

    // Handle tool calls
    if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length) {
      const toolCalls = choice.message.tool_calls;
      const toolResults: any[] = [];

      for (const tc of toolCalls) {
        const args = JSON.parse(tc.function.arguments);
        let resultContent = "";

        try {
          if (tc.function.name === "create_plan") {
            const { data, error } = await supabase.from("plans").insert({
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
            resultContent = JSON.stringify({ success: true, plan: data });
          } else if (tc.function.name === "update_plan") {
            const updates: any = {};
            if (args.title) updates.title = args.title;
            if (args.activity) updates.activity = args.activity;
            if (args.date) updates.date = new Date(args.date).toISOString();
            if (args.time_slot) updates.time_slot = args.time_slot;
            if (args.duration) updates.duration = args.duration;
            if (args.location !== undefined) updates.location = args.location;
            if (args.notes !== undefined) updates.notes = args.notes;

            const { error } = await supabase.from("plans").update(updates).eq("id", args.plan_id).eq("user_id", user.id);
            if (error) throw error;
            resultContent = JSON.stringify({ success: true });
          } else if (tc.function.name === "delete_plan") {
            const { error } = await supabase.from("plans").delete().eq("id", args.plan_id).eq("user_id", user.id);
            if (error) throw error;
            resultContent = JSON.stringify({ success: true });
          }
        } catch (e: any) {
          resultContent = JSON.stringify({ error: e.message });
        }

        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: resultContent,
        });
      }

      // Second AI call with tool results to get final message
      const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            choice.message,
            ...toolResults,
          ],
          stream: false,
        }),
      });

      if (!followUp.ok) throw new Error("Follow-up AI call failed");
      const followUpResult = await followUp.json();
      const finalMessage = followUpResult.choices?.[0]?.message?.content || "Done! ✅";

      // Determine which tool actions were performed
      const actions = toolCalls.map((tc: any) => ({
        type: tc.function.name,
        args: JSON.parse(tc.function.arguments),
      }));

      return new Response(JSON.stringify({ 
        message: finalMessage, 
        actions,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No tool calls - just return the message
    return new Response(JSON.stringify({ 
      message: choice?.message?.content || "I'm not sure how to help with that. Could you rephrase?",
      actions: [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-with-elly error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Something went wrong" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
