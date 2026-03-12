import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Priority beta inviters — Austin and Ben Scho
const PRIORITY_INVITER_IDS = [
  '30279b3f-657b-49cf-b38a-bd0d042172f2', // austin
  '377e35fb-dcb5-4324-baee-7b83be7ddc45', // Ben Scho
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOOPS_API_KEY = Deno.env.get('LOOPS_API_KEY');
    if (!LOOPS_API_KEY) {
      throw new Error('LOOPS_API_KEY is not configured');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, first_name, last_name')
      .eq('user_id', user_id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      throw new Error('Failed to fetch profile');
    }

    // Get email from auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user_id);

    if (authError || !authUser?.user?.email) {
      console.error('Error fetching auth user:', authError);
      throw new Error('Failed to fetch user email');
    }

    const email = authUser.user.email;
    const firstName = profile?.first_name || profile?.display_name || undefined;
    const lastName = profile?.last_name || undefined;

    // Check if this user was invited by a priority inviter (Austin or Ben Scho)
    // Look for friendships where this user is linked to a priority inviter
    const { data: priorityFriendships } = await supabase
      .from('friendships')
      .select('user_id')
      .eq('friend_user_id', user_id)
      .in('user_id', PRIORITY_INVITER_IDS)
      .limit(1);

    const isPriorityBeta = (priorityFriendships && priorityFriendships.length > 0);
    const userGroup = isPriorityBeta ? 'priority-beta' : 'signed-up';

    console.log(`User ${email} classified as: ${userGroup}${isPriorityBeta ? ' (invited by priority inviter)' : ''}`);

    // Create/update contact in Loops
    const loopsBody: Record<string, unknown> = {
      email: email.trim().toLowerCase(),
      firstName: firstName?.trim()?.slice(0, 100) || undefined,
      lastName: lastName?.trim()?.slice(0, 100) || undefined,
      source: 'parade-signup',
      userGroup,
    };

    const response = await fetch('https://app.loops.so/api/v1/contacts/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loopsBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Loops API error:', response.status, JSON.stringify(data));
      if (response.status === 409 || data?.message?.includes('already')) {
        // Contact exists — update with the correct group
        const updateResponse = await fetch('https://app.loops.so/api/v1/contacts/update', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${LOOPS_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(loopsBody),
        });

        if (!updateResponse.ok) {
          const updateData = await updateResponse.json();
          console.error('Loops update error:', updateResponse.status, JSON.stringify(updateData));
        }

        return new Response(
          JSON.stringify({ success: true, action: 'updated', userGroup }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Loops API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    console.log(`Synced user ${user_id} (${email}) to Loops as ${userGroup}`);

    return new Response(
      JSON.stringify({ success: true, action: 'created', userGroup }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-user-to-loops:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
