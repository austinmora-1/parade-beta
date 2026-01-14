import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  email: string;
  inviterName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, inviterName = "A friend" }: InviteEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Parade <onboarding@resend.dev>",
        to: [email],
        subject: `${inviterName} invited you to join Parade! 🎉`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); padding: 40px 30px; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">🎉 You're Invited!</h1>
                      </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <p style="margin: 0 0 20px; font-size: 18px; color: #18181b; line-height: 1.6;">
                          Hey there! 👋
                        </p>
                        <p style="margin: 0 0 20px; font-size: 16px; color: #3f3f46; line-height: 1.6;">
                          <strong style="color: #8b5cf6;">${inviterName}</strong> thinks you'd be a great addition to <strong>Parade</strong> — the easiest way to coordinate plans with friends!
                        </p>
                        <p style="margin: 0 0 30px; font-size: 16px; color: #3f3f46; line-height: 1.6;">
                          With Parade, you can:
                        </p>
                        <ul style="margin: 0 0 30px; padding-left: 20px; color: #3f3f46; font-size: 16px; line-height: 1.8;">
                          <li>📅 Share your availability effortlessly</li>
                          <li>🤝 See when friends are free to hang out</li>
                          <li>✨ Plan meetups without the endless back-and-forth</li>
                          <li>🎯 Never miss a chance to connect</li>
                        </ul>
                        
                        <!-- CTA Button -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" style="padding: 10px 0 30px;">
                              <a href="https://parade.lovable.app" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 40px; border-radius: 50px; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                                Join the Party 🎊
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 0; font-size: 14px; color: #71717a; line-height: 1.6; text-align: center;">
                          We can't wait to see you there!
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #fafafa; padding: 25px 30px; text-align: center; border-top: 1px solid #e4e4e7;">
                        <p style="margin: 0; font-size: 13px; color: #a1a1aa;">
                          Sent with 💜 from the Parade team
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
