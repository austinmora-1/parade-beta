import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PlanInviteRequest {
  email: string;
  inviterName: string;
  planTitle: string;
  planActivity: string;
  planDate: string;      // e.g. "Friday, May 2"
  planTime: string;      // e.g. "7:00pm – 9:00pm" or "Evening"
  planLocation?: string; // e.g. "Bar Boulud"
  inviteUrl: string;
}

function getActivityEmoji(activity: string): string {
  const map: Record<string, string> = {
    drinks: '🍻', 'get-food': '🍽️', concert: '🎵', hiking: '🥾',
    'hanging-out': '✨', museum: '🏛️', sightseeing: '📸',
    'one-on-one': '☕', beach: '🏖️', park: '🌳', gym: '💪',
    yoga: '🧘', running: '🏃', swimming: '🏊', surfing: '🏄',
    movies: '🎬', 'watching-movie': '🎬', 'watching-tv': '📺',
    movies: '🎬', 'watching-movie': '🎬', 'watching-tv': '📺',
    'sports-event': '🏟️', dancing: '💃', shopping: '🛍️',
    'stand-up-comedy': '😂', 'theme-park': '🎢', facetime: '📱',
    volunteering: '🤝', 'wine-tasting': '🍷', 'listening-music': '🎧',
    reading: '📚', 'walking-dog': '🐕',
  };
  return map[activity] || '📅';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const body: PlanInviteRequest = await req.json();
    const { email, inviterName, planTitle, planActivity, planDate, planTime, planLocation, inviteUrl } = body;

    if (!email || !inviteUrl) {
      return new Response(
        JSON.stringify({ error: "email and inviteUrl are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const emoji = getActivityEmoji(planActivity);
    const displayTitle = planTitle || 'a plan';
    const subject = `${inviterName} invited you to "${displayTitle}" ${emoji}`;

    const locationRow = planLocation
      ? `<tr>
           <td style="padding: 6px 0; vertical-align: top;">
             <span style="font-size: 14px;">📍</span>
           </td>
           <td style="padding: 6px 0 6px 8px; font-size: 15px; color: #3f3f46; line-height: 1.5;">
             ${planLocation}
           </td>
         </tr>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #ffffff; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e4e4e7;">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a2e22; padding: 0; text-align: center;">
              <img src="https://womtzaraskisayzskafe.supabase.co/storage/v1/object/public/og-pages/email-wordmark.png" alt="Parade" width="560" style="display: block; width: 100%; max-width: 560px; height: auto;" />
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 36px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #18181b; line-height: 1.7;">
                Hey there 👋
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #3f3f46; line-height: 1.7;">
                <strong style="color: #18181b;">${inviterName}</strong> invited you to a plan on Parade:
              </p>
              
              <!-- Plan details card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f5; border-radius: 12px; margin: 0 0 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #1a2b22;">
                      ${emoji} ${displayTitle}
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 6px 0; vertical-align: top;">
                          <span style="font-size: 14px;">📅</span>
                        </td>
                        <td style="padding: 6px 0 6px 8px; font-size: 15px; color: #3f3f46; line-height: 1.5;">
                          ${planDate}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; vertical-align: top;">
                          <span style="font-size: 14px;">🕐</span>
                        </td>
                        <td style="padding: 6px 0 6px 8px; font-size: 15px; color: #3f3f46; line-height: 1.5;">
                          ${planTime}
                        </td>
                      </tr>
                      ${locationRow}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 28px;">
                    <a href="${inviteUrl}" style="display: inline-block; background-color: #55C78E; color: #111E16; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 12px;">
                      View Plan & Join
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; font-size: 12px; color: #8a9b92;">
                If you weren't expecting this, no worries — just ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 0; text-align: center; background-color: #1a6e4a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-image: url('https://womtzaraskisayzskafe.supabase.co/storage/v1/object/public/og-pages/email-footer-confetti.png'); background-size: cover; background-position: center;">
                <tr>
                  <td style="padding: 28px 30px; text-align: center;">
                    <p style="margin: 0 0 6px; font-size: 13px; color: #ffffff; font-weight: 500;">
                      Sent via Parade
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
</html>`;

    const plainText = `Hey there!\n\n${inviterName} invited you to a plan on Parade:\n\n${emoji} ${displayTitle}\n📅 ${planDate}\n🕐 ${planTime}${planLocation ? `\n📍 ${planLocation}` : ''}\n\nView Plan & Join: ${inviteUrl}\n\nSent via Parade — helloparade.app`;

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
        subject,
        headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
        html,
        text: plainText,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "Failed to send email");
    }

    const emailResponse = await res.json();
    console.log("Plan invite email sent:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending plan invite email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
