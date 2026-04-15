import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limiter.ts';

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

// Map feedback types to Linear project names
const PROJECT_MAP: Record<string, string> = {
  bug: "Production Support",
  feature: "Enhancements",
  general: "Feedback",
};

function buildAuthHeader(apiKey: string): string {
  if (apiKey.startsWith("lin_api_") || apiKey.startsWith("Bearer ")) {
    return apiKey;
  }
  return `Bearer ${apiKey}`;
}

async function linearQuery(apiKey: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: buildAuthHeader(apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function getLinearTeamId(apiKey: string): Promise<string> {
  const data = await linearQuery(apiKey, `{ teams { nodes { id name } } }`);
  if (!data.data?.teams?.nodes?.length) {
    throw new Error(`Failed to fetch Linear teams: ${JSON.stringify(data)}`);
  }
  return data.data.teams.nodes[0].id;
}

async function getOrCreateProject(apiKey: string, teamId: string, projectName: string): Promise<string | null> {
  // Search existing projects
  const data = await linearQuery(apiKey, `{ projects(filter: { name: { eq: "${projectName}" } }) { nodes { id name } } }`);
  const existing = data.data?.projects?.nodes?.[0];
  if (existing) return existing.id;

  // Create the project
  try {
    const createData = await linearQuery(apiKey,
      `mutation($input: ProjectCreateInput!) { projectCreate(input: $input) { success project { id } } }`,
      { input: { name: projectName, teamIds: [teamId] } }
    );
    return createData.data?.projectCreate?.project?.id || null;
  } catch (e) {
    console.error(`Failed to create project "${projectName}":`, e);
    return null;
  }
}

async function getOrCreateLabel(apiKey: string, teamId: string, labelName: string): Promise<string> {
  // Search team labels
  const searchData = await linearQuery(apiKey,
    `{ issueLabels(filter: { name: { eq: "${labelName}" }, team: { id: { eq: "${teamId}" } } }) { nodes { id name } } }`
  );
  const existing = searchData.data?.issueLabels?.nodes?.[0];
  if (existing) return existing.id;

  // Search workspace labels
  const wsData = await linearQuery(apiKey,
    `{ issueLabels(filter: { name: { eq: "${labelName}" }, team: { null: true } }) { nodes { id name } } }`
  );
  const wsExisting = wsData.data?.issueLabels?.nodes?.[0];
  if (wsExisting) return wsExisting.id;

  // Create label
  const createData = await linearQuery(apiKey,
    `mutation { issueLabelCreate(input: { name: "${labelName}", teamId: "${teamId}" }) { issueLabel { id } } }`
  );
  const created = createData.data?.issueLabelCreate?.issueLabel?.id;
  if (!created) throw new Error(`Failed to create label "${labelName}": ${JSON.stringify(createData)}`);
  return created;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeaderVal = req.headers.get("Authorization");
    if (!authHeaderVal?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeaderVal } } }
    );

    const token = authHeaderVal.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const rateCheck = await checkRateLimit(adminClient, userId, 'submit-feedback', 10, 3600);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter!, corsHeaders);

    const { feedbackType, message } = await req.json();
    if (!feedbackType || !message) {
      return new Response(JSON.stringify({ error: "Missing feedbackType or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();

    const userName = profile?.display_name || "Unknown User";

    // Save to database
    const { error: insertError } = await supabase
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

        // Get or create the target project
        const projectName = PROJECT_MAP[feedbackType] || "Feedback";
        const projectId = await getOrCreateProject(linearApiKey, teamId, projectName);

        const titlePrefix = TITLE_PREFIX[feedbackType] || "💬 Feedback";
        const issueTitle = `${titlePrefix}: ${message.substring(0, 80)}${message.length > 80 ? "…" : ""}`;
        const description = `**From:** ${userName}\n**Type:** ${feedbackType}\n**Date:** ${new Date().toISOString()}\n\n---\n\n${message}`;

        const input: Record<string, unknown> = {
          teamId,
          title: issueTitle,
          description,
          labelIds: [labelId],
        };
        if (projectId) {
          input.projectId = projectId;
        }

        const data = await linearQuery(linearApiKey,
          `mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }`,
          { input }
        );
        if (!data.data?.issueCreate?.success) {
          throw new Error(`Linear issue creation failed: ${JSON.stringify(data)}`);
        }
      } catch (linearError) {
        console.error("Linear sync failed:", linearError);
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
