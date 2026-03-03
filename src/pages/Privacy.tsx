import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="mb-6 gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <h1 className="font-display text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 3, 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Parade ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile and web application ("Parade" or the "App").
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <h3 className="text-lg font-medium mb-2">Account Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you create an account, we collect your name, email address, and optionally your phone number and profile photo.
            </p>
            <h3 className="text-lg font-medium mb-2 mt-4">Availability & Calendar Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              If you connect your Google Calendar, we read your calendar events to determine when you are busy. We only store whether you are available or busy during time slots — we do not store event titles, descriptions, or attendee details. Your friends only see that you are "busy," never the details of your events.
            </p>
            <h3 className="text-lg font-medium mb-2 mt-4">Location Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              You may optionally share your general location status (e.g., "home," "traveling") with friends. We do not track your precise GPS location.
            </p>
            <h3 className="text-lg font-medium mb-2 mt-4">Usage Data</h3>
            <p className="text-muted-foreground leading-relaxed">
              We collect anonymized usage data to improve the App, including pages visited, features used, and error logs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>To provide and maintain the App's core features (availability sharing, plan coordination, messaging)</li>
              <li>To send you notifications about friend requests, plan updates, and other activity you've opted into</li>
              <li>To sync your calendar availability (if connected)</li>
              <li>To improve and personalize your experience</li>
              <li>To respond to your support requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell your personal information. We share information only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-2">
              <li><strong>With your friends:</strong> Your display name, avatar, availability status, and vibe status are visible to people you've connected with on Parade.</li>
              <li><strong>With service providers:</strong> We use trusted third-party services for hosting, authentication, and calendar integration. These providers are bound by contractual obligations to protect your data.</li>
              <li><strong>For legal compliance:</strong> We may disclose information if required by law or to protect our rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures including encryption in transit (TLS), secure authentication, and row-level security on our database to ensure your data is only accessible to you and authorized parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your account data for as long as your account is active. You may delete your account at any time through the Settings page, which will remove your personal data from our systems.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to access, correct, or delete your personal data. You can manage your privacy settings within the App, including controlling what information is visible to friends. To exercise these rights or for any privacy-related questions, contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Parade is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:privacy@helloparade.app" className="text-primary hover:underline">
                privacy@helloparade.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
