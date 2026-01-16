import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface HangRequestPayload {
  shareCode: string;
  requesterName: string;
  requesterEmail?: string;
  message?: string;
  selectedDay: string;
  selectedSlot: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: HangRequestPayload = await req.json();
    const { shareCode, requesterName, requesterEmail, message, selectedDay, selectedSlot } = payload;

    if (!shareCode || !requesterName || !selectedDay || !selectedSlot) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the user by share code
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .eq("share_code", shareCode)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Invalid share code" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the user's email from auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.user_id);

    if (userError || !userData?.user?.email) {
      console.error("Could not find user email:", userError);
      return new Response(
        JSON.stringify({ error: "Could not find user" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userEmail = userData.user.email;
    const userName = profile.display_name || "there";

    // Save the hang request to the database
    const { error: insertError } = await supabase
      .from("hang_requests")
      .insert({
        user_id: profile.user_id,
        share_code: shareCode,
        requester_name: requesterName,
        requester_email: requesterEmail || null,
        message: message || null,
        selected_day: selectedDay,
        selected_slot: selectedSlot,
        status: 'pending'
      });

    if (insertError) {
      console.error("Error saving hang request:", insertError);
      // Continue to send email even if save fails
    }

    // Send notification email via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Parade <onboarding@resend.dev>",
        reply_to: requesterEmail || undefined,
        to: [userEmail],
        subject: `${requesterName} wants to hang out! 🎉`,
        headers: {
          "X-Entity-Ref-ID": crypto.randomUUID(),
        },
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
            <div style="max-width: 500px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                <div style="text-align: center; margin-bottom: 24px;">
                  <span style="font-size: 48px;">🎉</span>
                </div>
                
                <h1 style="font-size: 24px; font-weight: 600; color: #1a1a1a; margin: 0 0 16px; text-align: center;">
                  Someone wants to hang!
                </h1>
                
                <p style="font-size: 16px; color: #666; margin: 0 0 24px; text-align: center;">
                  Hey ${userName}, <strong>${requesterName}</strong> saw your availability and wants to make plans!
                </p>
                
                <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size: 20px; padding-right: 12px; vertical-align: top;">📅</td>
                            <td>
                              <div style="font-size: 14px; color: #999; margin-bottom: 2px;">When</div>
                              <div style="font-size: 16px; font-weight: 500; color: #1a1a1a;">${selectedDay} - ${selectedSlot}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    
                    ${requesterEmail ? `
                    <tr>
                      <td style="padding-bottom: 12px;">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size: 20px; padding-right: 12px; vertical-align: top;">✉️</td>
                            <td>
                              <div style="font-size: 14px; color: #999; margin-bottom: 2px;">Reply to</div>
                              <div style="font-size: 16px; font-weight: 500; color: #1a1a1a;">
                                <a href="mailto:${requesterEmail}" style="color: #8b5cf6; text-decoration: none;">${requesterEmail}</a>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    ` : ''}
                    
                    ${message ? `
                    <tr>
                      <td>
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="font-size: 20px; padding-right: 12px; vertical-align: top;">💬</td>
                            <td>
                              <div style="font-size: 14px; color: #999; margin-bottom: 2px;">Message</div>
                              <div style="font-size: 16px; color: #1a1a1a;">${message}</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    ` : ''}
                  </table>
                </div>
                
                ${requesterEmail ? `
                <a href="mailto:${requesterEmail}?subject=Let's hang out!&body=Hey ${requesterName}! I got your request to hang out on ${selectedDay}. Let's make it happen!" 
                   style="display: block; width: 100%; padding: 16px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-align: center; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-sizing: border-box;">
                  Reply to ${requesterName}
                </a>
                ` : `
                <p style="font-size: 14px; color: #999; text-align: center; margin: 0;">
                  ${requesterName} didn't leave contact info - hopefully you know who they are! 😄
                </p>
                `}
              </div>
              
              <p style="font-size: 12px; color: #999; text-align: center; margin-top: 24px;">
                Sent from <a href="https://helloparade.app" style="color: #8b5cf6; text-decoration: none;">Parade</a>
              </p>
            </div>
          </body>
          </html>
        `,
        text: `Hey ${userName}! ${requesterName} saw your availability and wants to make plans!\n\nWhen: ${selectedDay} - ${selectedSlot}\n${requesterEmail ? `Reply to: ${requesterEmail}\n` : ''}${message ? `Message: ${message}\n` : ''}\n\nSent from Parade - helloparade.app`,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Failed to send email");
    }

    const emailResponse = await res.json();
    console.log("Hang request email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-hang-request function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
