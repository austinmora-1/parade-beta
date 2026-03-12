import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Use service role to fetch user data
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

    // Create/update contact in Loops
    const response = await fetch('https://app.loops.so/api/v1/contacts/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        firstName: firstName?.trim()?.slice(0, 100) || undefined,
        lastName: lastName?.trim()?.slice(0, 100) || undefined,
        source: 'parade-signup',
        userGroup: 'signed-up',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Loops API error:', response.status, JSON.stringify(data));
      // If contact already exists, try to update instead
      if (response.status === 409 || data?.message?.includes('already')) {
        const updateResponse = await fetch('https://app.loops.so/api/v1/contacts/update', {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${LOOPS_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            firstName: firstName?.trim()?.slice(0, 100) || undefined,
            lastName: lastName?.trim()?.slice(0, 100) || undefined,
            source: 'parade-signup',
            userGroup: 'signed-up',
          }),
        });

        if (!updateResponse.ok) {
          const updateData = await updateResponse.json();
          console.error('Loops update error:', updateResponse.status, JSON.stringify(updateData));
        }

        return new Response(
          JSON.stringify({ success: true, action: 'updated' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Loops API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    console.log(`Synced user ${user_id} (${email}) to Loops`);

    return new Response(
      JSON.stringify({ success: true, action: 'created' }),
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
