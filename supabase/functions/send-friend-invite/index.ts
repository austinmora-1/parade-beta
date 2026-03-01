import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  email: string;
  inviterName?: string;
  customSubject?: string;
  customMessage?: string;
  customUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Authenticated user sending invite:', userId);

    const { email, inviterName = "A friend", customSubject, customMessage, customUrl }: InviteEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const inviteUrl = customUrl || `https://helloparade.app/invite?ref=${encodeURIComponent(inviterName)}`;
    const emailSubject = customSubject || `${inviterName} wants to make plans with you`;
    const emailIntro = customMessage || `<strong style="color: #8b5cf6;">${inviterName}</strong> invited you to join them on Parade — the easiest way to coordinate plans with friends.`;
    const ctaText = customUrl ? 'View Plan & Join' : 'Accept Invitation';

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Parade <hello@helloparade.app>",
        reply_to: "hello@helloparade.app",
        to: [email],
        subject: emailSubject,
        headers: {
          "X-Entity-Ref-ID": crypto.randomUUID(),
          "List-Unsubscribe": "<https://helloparade.app/unsubscribe>",
        },
        html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="color-scheme" content="light">
            <meta name="supported-color-schemes" content="light">
            <title>Join ${inviterName} on Parade</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; -webkit-font-smoothing: antialiased;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden;">
                    <!-- Header with Logo -->
                    <tr>
                      <td style="background-color: #8b5cf6; padding: 32px 30px; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Parade</h1>
                        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Make plans, not excuses</p>
                      </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="margin: 0 0 20px; font-size: 18px; color: #18181b; line-height: 1.6;">
                          Hi there,
                        </p>
                        <p style="margin: 0 0 20px; font-size: 16px; color: #3f3f46; line-height: 1.6;">
                          ${emailIntro}
                        </p>
                        ${!customMessage ? `<p style="margin: 0 0 24px; font-size: 16px; color: #3f3f46; line-height: 1.6;">
                          Here's what you can do together:
                        </p>` : ''}
                          Here's what you can do together:
                        ${!customMessage ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px;">
                          <tr>
                            <td style="padding: 12px 16px; background-color: #faf5ff; border-radius: 8px; margin-bottom: 8px;">
                              <p style="margin: 0; font-size: 15px; color: #3f3f46;">Share when you're free to hang out</p>
                            </td>
                          </tr>
                          <tr><td style="height: 8px;"></td></tr>
                          <tr>
                            <td style="padding: 12px 16px; background-color: #faf5ff; border-radius: 8px;">
                              <p style="margin: 0; font-size: 15px; color: #3f3f46;">See when friends are available</p>
                            </td>
                          </tr>
                          <tr><td style="height: 8px;"></td></tr>
                          <tr>
                            <td style="padding: 12px 16px; background-color: #faf5ff; border-radius: 8px;">
                              <p style="margin: 0; font-size: 15px; color: #3f3f46;">Plan meetups without the back-and-forth</p>
                            </td>
                          </tr>
                        </table>` : ''}
                        
                        <!-- CTA Button -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 10px 0 30px;">
                              <a href="${inviteUrl}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px; mso-padding-alt: 0;">
                                <!--[if mso]>
                                <i style="mso-font-width:200%;mso-text-raise:24pt">&nbsp;</i>
                                <![endif]-->
                                <span style="mso-text-raise:12pt;">${ctaText}</span>
                                <!--[if mso]>
                                <i style="mso-font-width:200%;">&nbsp;</i>
                                <![endif]-->
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 0; font-size: 14px; color: #71717a; line-height: 1.6; text-align: center;">
                          Or copy this link: <a href="${inviteUrl}" style="color: #8b5cf6; text-decoration: underline;">${inviteUrl}</a>
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #fafafa; padding: 24px 30px; text-align: center; border-top: 1px solid #e4e4e7;">
                        <p style="margin: 0 0 8px; font-size: 13px; color: #71717a;">
                          This email was sent by Parade
                        </p>
                        <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                          <a href="https://helloparade.app" style="color: #a1a1aa; text-decoration: none;">helloparade.app</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
        text: `${inviterName} invited you to join them on Parade - the easiest way to coordinate plans with friends.\n\nWith Parade you can:\n- Share when you're free to hang out\n- See when friends are available\n- Plan meetups without the back-and-forth\n\nAccept the invitation: ${inviteUrl}\n\nOr visit: helloparade.app`,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      const errorMessage = errorData.message || "Failed to send email";
      
      // Check for domain verification error
      if (errorMessage.includes("verify a domain") || errorMessage.includes("testing emails")) {
        throw new Error("To send invites to friends, please verify your domain at resend.com/domains. For now, you can only send test emails to your own email address.");
      }
      
      throw new Error(errorMessage);
    }

    const emailResponse = await res.json();
    console.log("Invite email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending invite email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
