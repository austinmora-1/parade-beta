import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="mb-6 gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <h1 className="font-display text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 3, 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Parade ("the App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the App.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Parade is a social coordination app that helps friends share availability, make plans, and stay connected. The App allows users to share their free time, create and manage plans, send vibes, and communicate with friends.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Account Registration</h2>
            <p className="text-muted-foreground leading-relaxed">
              To use Parade, you must create an account with a valid email address. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">You agree not to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
              <li>Use the App for any unlawful purpose or in violation of any applicable laws</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Send spam, unsolicited messages, or misleading content</li>
              <li>Attempt to gain unauthorized access to other user accounts or our systems</li>
              <li>Use automated tools to scrape, collect, or harvest user data</li>
              <li>Impersonate another person or misrepresent your identity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. User Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of content you create on Parade (messages, photos, plans). By posting content, you grant us a limited license to display and deliver that content to your intended recipients within the App. We do not claim ownership of your content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Third-Party Integrations</h2>
            <p className="text-muted-foreground leading-relaxed">
              Parade integrates with third-party services such as Google Calendar. Your use of these integrations is subject to the respective third-party terms and privacy policies. We access your calendar data in read-only mode and do not modify your external calendar events.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your use of Parade is also governed by our{' '}
              <a href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </a>
              , which describes how we collect, use, and protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Availability & Uptime</h2>
            <p className="text-muted-foreground leading-relaxed">
              We strive to keep Parade available at all times, but we do not guarantee uninterrupted access. We may perform maintenance, updates, or experience outages. We are not liable for any loss resulting from service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to suspend or terminate your account if you violate these Terms. You may delete your account at any time through the Settings page. Upon termination, your data will be deleted in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              Parade is provided "as is" without warranties of any kind, either express or implied. We do not warrant that the App will be error-free, secure, or available at all times.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, Parade shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the App.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. Continued use of the App after changes constitutes acceptance of the updated Terms. We will notify users of material changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. AI Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              Parade uses artificial intelligence services to power certain features within the App, including but not limited to smart nudges, conversation assistance, and event suggestions. These AI-powered features are provided through third-party large language models (LLMs) and AI services, including models from Google (Gemini) and OpenAI (GPT). By using the App, you acknowledge and agree to the following:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
              <li>AI-generated content is provided for informational and convenience purposes only and should not be relied upon as professional, legal, medical, or financial advice</li>
              <li>AI responses may not always be accurate, complete, or up to date. Parade does not guarantee the correctness of any AI-generated output</li>
              <li>Your interactions with AI-powered features may be processed by third-party AI providers. We do not send personally identifiable information to these providers beyond what is necessary to deliver the feature</li>
              <li>AI models used by Parade may change over time as we improve our services. We reserve the right to update, replace, or discontinue AI providers without prior notice</li>
              <li>You agree not to use AI-powered features to generate harmful, misleading, or unlawful content</li>
              <li>Parade is not liable for any decisions made or actions taken based on AI-generated content within the App</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              For more information on how third-party AI providers handle data, please refer to their respective privacy policies and terms of service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these Terms, please contact us at{' '}
              <a href="mailto:support@helloparade.app" className="text-primary hover:underline">
                support@helloparade.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
