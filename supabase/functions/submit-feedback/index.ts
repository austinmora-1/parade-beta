import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map feedback types to Linear label names
const LABEL_MAP: Record<string, string> = {
  bug: "Bug",
  feature: "Enhancement",
  general: "Wishlist",
};

const TITLE_PREFIX: Record<string, string> = {
  bug: "🐛 Bug Report",
  feature: "✨ Feature Request",
  general: "💬 Feedback",
};

function authHeader(apiKey: string): string {
  // Linear personal API keys (lin_api_...) don't need Bearer prefix
  // but we add it if not already present for compatibility
  if (apiKey.startsWith("lin_api_") || apiKey.startsWith("Bearer ")) {
    return apiKey;
  }
  return `Bearer ${apiKey}`;
}

async function getLinearTeamId(apiKey: string): Promise<string> {
  console.log(`LINEAR_API_KEY length: ${apiKey.length}, starts with: ${apiKey.substring(0, 8)}`);
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `{ teams { nodes { id name } } }`,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.data?.teams?.nodes?.length) {
    throw new Error(`Failed to fetch Linear teams: ${JSON.stringify(data)}`);
  }
  return data.data.teams.nodes[0].id;
}

async function getOrCreateLabel(
  apiKey: string,
  teamId: string,
  labelName: string
): Promise<string> {
  // Search for existing label
  const searchRes = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: authHeader(apiKey), "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `{ issueLabels(filter: { name: { eq: "${labelName}" }, team: { id: { eq: "${teamId}" } } }) { nodes { id name } } }`,
    }),
  });
  const searchData = await searchRes.json();
  const existing = searchData.data?.issueLabels?.nodes?.[0];
  if (existing) return existing.id;

  // Also check workspace-level labels (no team filter)
  const wsRes = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: authHeader(apiKey), "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `{ issueLabels(filter: { name: { eq: "${labelName}" }, team: { null: true } }) { nodes { id name } } }`,
    }),
  });
  const wsData = await wsRes.json();
  const wsExisting = wsData.data?.issueLabels?.nodes?.[0];
  if (wsExisting) return wsExisting.id;

  // Create label on the team
  const createRes = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: authHeader(apiKey), "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation { issueLabelCreate(input: { name: "${labelName}", teamId: "${teamId}" }) { issueLabel { id } } }`,
    }),
  });
  const createData = await createRes.json();
  const created = createData.data?.issueLabelCreate?.issueLabel?.id;
  if (!created) {
    throw new Error(`Failed to create label "${labelName}": ${JSON.stringify(createData)}`);
  }
  return created;
}

async function createLinearIssue(
  apiKey: string,
  teamId: string,
  labelId: string,
  title: string,
  description: string
): Promise<{ id: string; identifier: string; url: string }> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier url }
        }
      }`,
      variables: {
        input: {
          teamId,
          title,
          description,
          labelIds: [labelId],
        },
      },
    }),
  });
  const data = await res.json();
  if (!data.data?.issueCreate?.success) {
    throw new Error(`Linear issue creation failed: ${JSON.stringify(data)}`);
  }
  return data.data.issueCreate.issue;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const { feedbackType, message } = await req.json();
    if (!feedbackType || !message) {
      return new Response(JSON.stringify({ error: "Missing feedbackType or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user display name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();

    const userName = profile?.display_name || "Unknown User";

    // Save to database
    const { data: feedback, error: insertError } = await supabase
      .from("feedback")
      .insert({ user_id: userId, feedback_type: feedbackType, message })
      .select()
      .single();

    if (insertError) {
      throw new Error(`DB insert failed: ${insertError.message}`);
    }

    // Create Linear issue
    const linearApiKey = Deno.env.get("LINEAR_API_KEY");
    if (linearApiKey) {
      try {
        const teamId = await getLinearTeamId(linearApiKey);
        const labelName = LABEL_MAP[feedbackType] || "Wishlist";
        const labelId = await getOrCreateLabel(linearApiKey, teamId, labelName);

        const titlePrefix = TITLE_PREFIX[feedbackType] || "💬 Feedback";
        const issueTitle = `${titlePrefix}: ${message.substring(0, 80)}${message.length > 80 ? "…" : ""}`;
        const description = `**From:** ${userName}\n**Type:** ${feedbackType}\n**Date:** ${new Date().toISOString()}\n\n---\n\n${message}`;

        await createLinearIssue(linearApiKey, teamId, labelId, issueTitle, description);
      } catch (linearError) {
        console.error("Linear sync failed:", linearError);
        // Don't fail the request — feedback is saved in DB
      }
    } else {
      console.warn("LINEAR_API_KEY not set, skipping Linear sync");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Feedback submission error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
