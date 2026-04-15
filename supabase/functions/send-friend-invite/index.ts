import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limiter.ts';
import { createLogger, generateRequestId } from '../_shared/logger.ts';

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

    const userId = claimsData.claims.sub as string;
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const rateCheck = await checkRateLimit(adminClient, userId, 'send-friend-invite', 20, 3600);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter!, corsHeaders);

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
    const emailSubject = customSubject || `${inviterName} invited you to Parade`;
    const ctaText = customUrl ? 'View Plan & Join' : 'Join Parade';

    // Try to extract a first name from the recipient email (fallback)
    const recipientFirstName = email.split('@')[0].replace(/[._-]/g, ' ').split(' ')[0];
    const capitalizedName = recipientFirstName.charAt(0).toUpperCase() + recipientFirstName.slice(1);

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
            <title>${inviterName} invited you to Parade</title>
            <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ffffff; -webkit-font-smoothing: antialiased;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e4e4e7;">
                    <!-- Header with wordmark image -->
                    <tr>
                      <td style="background-color: #1a2e22; padding: 0; text-align: center;">
                        <img src="https://womtzaraskisayzskafe.supabase.co/storage/v1/object/public/og-pages/email-wordmark.png" alt="Parade" width="560" style="display: block; width: 100%; max-width: 560px; height: auto;" />
                      </td>
                    </tr>
                    
                    <!-- Body with subtle green tint -->
                    <tr>
                      <td style="padding: 40px 30px; background-color: #ffffff;">
                        <p style="margin: 0 0 24px; font-size: 16px; color: #18181b; line-height: 1.7;">
                          Hey there,
                        </p>
                        <p style="margin: 0 0 20px; font-size: 16px; color: #3f3f46; line-height: 1.7;">
                          <strong style="color: #18181b;">${inviterName}</strong> thought you'd be a good fit for Parade — and honestly, that's the best way to join.
                        </p>
                        <p style="margin: 0 0 20px; font-size: 16px; color: #3f3f46; line-height: 1.7;">
                          Parade is a social calendar and platform built for one simple reason: making plans with the people you care about shouldn't be that hard. We built this app because we were tired of the endless "are you free?" texts, forgetting a friend mentioned they would be out of town, manually typing out your availability every time someone asked, and arriving at the weekend without anything planned.
                        </p>
                        <p style="margin: 0 0 20px; font-size: 16px; color: #3f3f46; line-height: 1.7;">
                          Your boss can book time with you in two clicks (unfortunately). Your best friend should be able to do the same — so we built something for that.
                        </p>
                        <p style="margin: 0 0 28px; font-size: 16px; color: #3f3f46; line-height: 1.7;">
                          The idea is simple: connect your existing calendar(s), share your availability, see when your friends are free, and make your plans without all the back-and-forth. No corporate scheduling links. No friction. No missed opportunities to hang. Just a tool that makes the fun stuff easier to make happen.
                        </p>
                        
                        <!-- CTA Button -->
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 10px 0 30px;">
                              <a href="${inviteUrl}" style="display: inline-block; background-color: #55C78E; color: #111E16; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 12px; mso-padding-alt: 0;">
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
                        
                        <p style="margin: 0 0 4px; font-size: 16px; color: #18181b; line-height: 1.7; font-weight: 600;">
                          Ben and Austin
                        </p>
                        <p style="margin: 0; font-size: 14px; color: #71717a; line-height: 1.6;">
                          From Parade
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer with confetti background -->
                    <tr>
                      <td style="padding: 0; text-align: center; background-color: #1a6e4a;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-image: url('https://womtzaraskisayzskafe.supabase.co/storage/v1/object/public/og-pages/email-footer-confetti.png'); background-size: cover; background-position: center;">
                          <tr>
                            <td style="padding: 32px 30px; text-align: center;">
                              <p style="margin: 0 0 8px; font-size: 13px; color: #ffffff; font-weight: 500;">
                                This email was sent by Parade
                              </p>
                              <p style="margin: 0; font-size: 12px;">
                                <a href="https://helloparade.app" style="color: rgba(255, 255, 255, 0.7); text-decoration: none;">helloparade.app</a>
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
        text: `Hey there,\n\n${inviterName} thought you'd be a good fit for Parade — and honestly, that's the best way to join.\n\nParade is a social calendar and platform built for one simple reason: making plans with the people you care about shouldn't be that hard. We built this app because we were tired of the endless "are you free?" texts, forgetting a friend mentioned they would be out of town, manually typing out your availability every time someone asked, and arriving at the weekend without anything planned.\n\nYour boss can book time with you in two clicks (unfortunately). Your best friend should be able to do the same — so we built something for that.\n\nThe idea is simple: connect your existing calendar(s), share your availability, see when your friends are free, and make your plans without all the back-and-forth. No corporate scheduling links. No friction. No missed opportunities to hang. Just a tool that makes the fun stuff easier to make happen.\n\nJoin Parade: ${inviteUrl}\n\nBen and Austin\nFrom Parade`,
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
