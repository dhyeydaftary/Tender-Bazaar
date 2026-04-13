import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Learn how TenderBazaar collects, uses, and protects your personal information.',
  openGraph: {
    title: 'Privacy Policy | TenderBazaar',
    description:
      'Learn how TenderBazaar collects, uses, and protects your personal information.',
  },
};

export default function PrivacyPage() {
  return (
    <div className="bg-background pt-32 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground">Privacy Policy</h1>
          <p className="mt-3 text-muted-foreground">Last updated: April 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none space-y-10 text-foreground/80 leading-relaxed">
          <p>
            TenderBazaar Technologies Private Limited (&quot;TenderBazaar&quot;,
            &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting
            your privacy. This Privacy Policy explains how we collect, use, disclose, and
            safeguard your information when you use our platform and services.
          </p>

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>

            <h3 className="text-lg font-medium text-foreground mt-4">Personal Information</h3>
            <p>When you register for an account or use our services, we may collect:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Full name and email address</li>
              <li>Phone number (for WhatsApp/SMS notifications)</li>
              <li>Password (stored in hashed form)</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4">Company Information</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Company name, GSTIN, PAN</li>
              <li>Industry, business category, and registration details</li>
              <li>Company size, annual turnover, and certifications</li>
              <li>Tender preferences and areas of interest</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4">Usage Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>IP address, browser type, and device information</li>
              <li>Pages visited, features used, and time spent on the platform</li>
              <li>Search queries and tender interaction history</li>
              <li>Notification preferences and interaction data</li>
            </ul>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>
                <strong className="text-foreground">Service Delivery:</strong> To provide tender
                recommendations, eligibility assessments, and personalised alerts.
              </li>
              <li>
                <strong className="text-foreground">Notifications:</strong> To send tender alerts,
                deadline reminders, and service updates via email, WhatsApp, SMS, and push
                notifications based on your preferences.
              </li>
              <li>
                <strong className="text-foreground">Analytics &amp; Improvement:</strong> To analyse
                usage patterns, improve our platform, and develop new features.
              </li>
              <li>
                <strong className="text-foreground">Communication:</strong> To respond to your
                inquiries, provide customer support, and send important service
                announcements.
              </li>
              <li>
                <strong className="text-foreground">Legal Compliance:</strong> To comply with
                applicable laws, regulations, and legal processes.
              </li>
            </ol>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Data Storage &amp; Security</h2>
            <p>
              We take the security of your data seriously and implement industry-standard
              measures to protect it:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption.</li>
              <li>Our infrastructure is hosted on Amazon Web Services (AWS) with servers located in the Mumbai (ap-south-1) region.</li>
              <li>We conduct regular security audits and vulnerability assessments.</li>
              <li>Access to personal data is restricted to authorised personnel only, following the principle of least privilege.</li>
              <li>Passwords are hashed using bcrypt with a minimum cost factor of 12.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Third-Party Services</h2>
            <p>
              We use the following third-party services that may process your data in
              accordance with their respective privacy policies:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className="text-foreground">Razorpay:</strong> Payment processing (PCI DSS
                compliant). We do not store your credit/debit card details.
              </li>
              <li>
                <strong className="text-foreground">Amazon Web Services (AWS):</strong> Cloud
                infrastructure, email delivery (SES), and storage (S3).
              </li>
              <li>
                <strong className="text-foreground">Firebase Cloud Messaging (FCM):</strong> Push
                notification delivery for mobile and web.
              </li>
              <li>
                <strong className="text-foreground">Google Analytics:</strong> Website usage analytics
                (anonymised IP addresses).
              </li>
              <li>
                <strong className="text-foreground">WATI &amp; MSG91:</strong> WhatsApp and SMS
                notification delivery.
              </li>
              <li>
                <strong className="text-foreground">Anthropic (Claude API):</strong> AI-powered tender
                analysis and eligibility checking. Tender data is processed but not stored by
                Anthropic.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Cookies &amp; Tracking</h2>
            <p>We use cookies and similar technologies to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Maintain your session and authentication state</li>
              <li>Remember your preferences and settings</li>
              <li>Analyse platform usage and performance</li>
              <li>Deliver relevant content and improve user experience</li>
            </ul>
            <p className="mt-3">
              You can manage your cookie preferences at any time through the cookie consent
              banner or your browser settings. Essential cookies required for the Service to
              function cannot be disabled.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Your Rights</h2>
            <p>
              In accordance with the Information Technology Act, 2000 and applicable data
              protection regulations, you have the following rights:
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>
                <strong className="text-foreground">Right to Access:</strong> You may request a copy of
                the personal data we hold about you.
              </li>
              <li>
                <strong className="text-foreground">Right to Correction:</strong> You may request that
                we correct any inaccurate or incomplete personal data.
              </li>
              <li>
                <strong className="text-foreground">Right to Deletion:</strong> You may request
                deletion of your personal data, subject to legal retention obligations.
              </li>
              <li>
                <strong className="text-foreground">Right to Data Portability:</strong> You may request
                your data in a structured, machine-readable format.
              </li>
              <li>
                <strong className="text-foreground">Right to Withdraw Consent:</strong> You may
                withdraw consent for processing at any time, without affecting the
                lawfulness of prior processing.
              </li>
            </ol>
            <p className="mt-3">
              To exercise any of these rights, please contact our Data Protection Officer at{' '}
              <a href="mailto:dpo@tenderbazaar.com" className="text-primary-400 hover:text-primary-300 transition-colors">
                dpo@tenderbazaar.com
              </a>
              . We will respond to your request within 30 days.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active or as
              needed to provide the Service. Specific retention periods include:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Account data: retained for the duration of your account plus 90 days after deletion.</li>
              <li>Transaction records: retained for 8 years as required by Indian tax laws.</li>
              <li>Usage logs: retained for 12 months for analytics and security purposes.</li>
              <li>Support tickets: retained for 3 years from resolution date.</li>
            </ul>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Children&apos;s Privacy</h2>
            <p>
              TenderBazaar is not intended for use by individuals under the age of 18. We
              do not knowingly collect personal information from children. If we become
              aware that we have collected data from a child under 18, we will take steps to
              delete such information promptly.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by posting the new Privacy Policy on this page and updating
              the &quot;Last updated&quot; date. For significant changes, we will send a
              notification via email or in-app alert.
            </p>
            <p>
              Your continued use of the Service after the effective date of a revised
              Privacy Policy constitutes your acceptance of the updated terms.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices,
              please contact us:
            </p>
            <ul className="list-none space-y-1 ml-2">
              <li>
                <strong className="text-foreground">Data Protection Officer:</strong>{' '}
                <a href="mailto:dpo@tenderbazaar.com" className="text-primary-400 hover:text-primary-300 transition-colors">
                  dpo@tenderbazaar.com
                </a>
              </li>
              <li>
                <strong className="text-foreground">General Inquiries:</strong>{' '}
                <a href="mailto:privacy@tenderbazaar.com" className="text-primary-400 hover:text-primary-300 transition-colors">
                  privacy@tenderbazaar.com
                </a>
              </li>
              <li>
                <strong className="text-foreground">Address:</strong> TenderBazaar Technologies Pvt. Ltd.,
                Ahmedabad, Gujarat, India
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
