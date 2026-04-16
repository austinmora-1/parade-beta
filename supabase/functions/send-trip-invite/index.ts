import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from '../_shared/rate-limiter.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TripInviteRequest {
  email: string;
  inviterName: string;
  destination: string | null;
  proposalType: 'trip' | 'visit';
  inviteUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = claimsData.claims.sub as string;
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const rateCheck = await checkRateLimit(adminClient, userId, 'send-trip-invite', 30, 3600);
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck.retryAfter!, corsHeaders);

    const body: TripInviteRequest = await req.json();
    const { email, inviterName, destination, proposalType, inviteUrl } = body;

    if (!email || !inviteUrl) {
      return new Response(JSON.stringify({ error: "email and inviteUrl are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const isVisit = proposalType === 'visit';
    const emoji = isVisit ? '🏠' : '✈️';
    const verbLabel = isVisit ? 'visit' : 'trip';
    const titleLabel = destination
      ? `${isVisit ? 'Visit to' : 'Trip to'} ${destination}`
      : (isVisit ? 'a visit' : 'a trip');

    const subject = `${inviterName} invited you to ${titleLabel} ${emoji}`;

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
          <tr>
            <td style="background-color: #1a2e22; padding: 0; text-align: center;">
              <img src="https://womtzaraskisayzskafe.supabase.co/storage/v1/object/public/og-pages/email-wordmark.png" alt="Parade" width="560" style="display: block; width: 100%; max-width: 560px; height: auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; color: #18181b; line-height: 1.7;">Hey there 👋</p>
              <p style="margin: 0 0 24px; font-size: 16px; color: #3f3f46; line-height: 1.7;">
                <strong style="color: #18181b;">${inviterName}</strong> invited you to ${isVisit ? 'a' : 'a'} ${verbLabel} on Parade:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f5; border-radius: 12px; margin: 0 0 28px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin: 0; font-size: 20px; font-weight: 700; color: #1a2b22;">
                      ${emoji} ${titleLabel}
                    </p>
                    <p style="margin: 8px 0 0; font-size: 14px; color: #3f3f46;">
                      Vote on dates, see who's joining, and lock in the plan.
                    </p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 28px;">
                    <a href="${inviteUrl}" style="display: inline-block; background-color: #55C78E; color: #111E16; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 36px; border-radius: 12px;">
                      View ${isVisit ? 'Visit' : 'Trip'} & Join
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 12px; color: #8a9b92;">
                If you weren't expecting this, no worries — just ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0; text-align: center; background-color: #1a6e4a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-image: url('https://womtzaraskisayzskafe.supabase.co/storage/v1/object/public/og-pages/email-footer-confetti.png'); background-size: cover; background-position: center;">
                <tr>
                  <td style="padding: 28px 30px; text-align: center;">
                    <p style="margin: 0 0 6px; font-size: 13px; color: #ffffff; font-weight: 500;">Sent via Parade</p>
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

    const plainText = `Hey there!\n\n${inviterName} invited you to ${verbLabel} on Parade:\n\n${emoji} ${titleLabel}\n\nView & Join: ${inviteUrl}\n\nSent via Parade — helloparade.app`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
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
    return new Response(JSON.stringify(emailResponse), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending trip invite email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
