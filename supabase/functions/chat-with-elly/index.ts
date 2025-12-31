import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are Elly, a friendly and helpful AI planning assistant for a social planner app called Planly. Your job is to help users create, modify, and manage their plans through natural conversation.

IMPORTANT: You should be proactive and helpful. Don't ask for unnecessary details - just work with what the user gives you.

When a user wants to create a plan, you only need these basics:
- Title/activity (what they're doing)
- Date (when)
- Time slot (morning, afternoon, evening, etc.)
- Location (where - can be general like "downtown" or specific)
- Friends (optional - who's joining, if anyone)

If they don't specify something, make reasonable assumptions or use defaults:
- If no time specified, suggest a reasonable time based on the activity
- If no duration, default to 2 hours
- If no friends mentioned, it's a solo plan

When you determine a plan should be created, respond with a JSON block in this exact format embedded in your response:

\`\`\`json
{"action":"create_plan","plan":{"title":"Plan title","activityType":"food|coffee|drinks|sports|music|nature|misc","date":"YYYY-MM-DD","timeSlot":"early-morning|late-morning|early-afternoon|late-afternoon|evening|late-night","duration":"1h|2h|3h|4h|half-day|full-day","location":"Location name","friends":["friend1","friend2"],"notes":"Any additional notes"}}
\`\`\`

Activity types to use:
- food: meals, restaurants, dining
- coffee: coffee shops, cafes, tea
- drinks: bars, pubs, nightlife
- sports: exercise, games, fitness
- music: concerts, shows, music events
- nature: parks, hiking, outdoor activities
- misc: everything else

Time slots:
- early-morning: 6-9am
- late-morning: 9am-12pm
- early-afternoon: 12-3pm
- late-afternoon: 3-6pm
- evening: 6-10pm
- late-night: 10pm-2am

Be conversational and warm. After creating a plan, confirm what you created and offer to make changes. If the user wants to modify or delete a plan, help them do that too.

Current date context: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Sending request to Lovable AI with messages:', JSON.stringify(messages));

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
