import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Read the Terms of Service for TenderBazaar, India\'s AI-powered tender aggregation platform.',
  openGraph: {
    title: 'Terms of Service | TenderBazaar',
    description:
      'Read the Terms of Service for TenderBazaar, India\'s AI-powered tender aggregation platform.',
  },
};

export default function TermsPage() {
  return (
    <div className="bg-background pt-32 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground">Terms of Service</h1>
          <p className="mt-3 text-muted-foreground">Last updated: April 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none space-y-10 text-foreground/80 leading-relaxed">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the TenderBazaar platform (&quot;Service&quot;), operated by
              TenderBazaar Technologies Private Limited (&quot;Company&quot;, &quot;we&quot;,
              &quot;us&quot;, or &quot;our&quot;), you agree to be bound by these Terms of
              Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not
              access or use the Service.
            </p>
            <p>
              These Terms apply to all visitors, users, and others who access the Service.
              By using the Service, you represent that you are at least 18 years of age and
              have the legal authority to enter into these Terms.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
            <p>
              TenderBazaar is a tender aggregation and management platform that collects and
              organises government tender information from publicly available sources
              including, but not limited to, the Government e-Marketplace (GeM), Central
              Public Procurement Portal (CPPP), and various state e-procurement websites.
            </p>
            <p>
              <strong className="text-foreground">Important:</strong> TenderBazaar is not a government portal
              and is not affiliated with any government agency. We aggregate publicly
              available tender data to help businesses discover and track opportunities. We
              do not guarantee the accuracy, completeness, or timeliness of tender
              information displayed on our platform.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">3. User Accounts</h2>
            <p>To access certain features of the Service, you must register for an account. When you register, you agree to:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Provide accurate, current, and complete information during the registration process.</li>
              <li>Maintain and promptly update your account information to keep it accurate, current, and complete.</li>
              <li>Maintain the security of your password and accept all risks of unauthorised access to your account.</li>
              <li>Immediately notify TenderBazaar if you discover or suspect any security breaches related to your account.</li>
              <li>Take responsibility for all activities that occur under your account.</li>
            </ol>
            <p>
              We reserve the right to suspend or terminate your account if any information
              provided during registration or thereafter proves to be inaccurate, not
              current, or incomplete.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Subscription Plans &amp; Payments</h2>
            <p>
              TenderBazaar offers various subscription plans (Free, Starter, Professional,
              and Enterprise) with different features and usage limits. Details of each plan
              are available on our Pricing page.
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>
                <strong className="text-foreground">Billing:</strong> Paid subscriptions are billed in advance on
                a monthly or annual basis. All prices are listed in Indian Rupees (INR) and
                are inclusive of applicable taxes unless stated otherwise.
              </li>
              <li>
                <strong className="text-foreground">Cancellation:</strong> You may cancel your subscription at
                any time from your account settings. Cancellation takes effect at the end of
                the current billing period.
              </li>
              <li>
                <strong className="text-foreground">Refunds:</strong> Refunds are processed in accordance with
                our Refund Policy. Please refer to our dedicated Refund Policy page for
                details.
              </li>
              <li>
                <strong className="text-foreground">Price Changes:</strong> We reserve the right to modify our
                pricing with 30 days&apos; notice. Existing subscribers will be notified via
                email before any price change takes effect.
              </li>
            </ol>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Scrape, crawl, or otherwise programmatically extract data from TenderBazaar without express written permission.</li>
              <li>Share your account credentials with third parties or allow multiple individuals to use a single account.</li>
              <li>Resell, sublicense, or redistribute tender data obtained from TenderBazaar.</li>
              <li>Use the Service for any unlawful purpose or in violation of any applicable laws or regulations.</li>
              <li>Attempt to reverse-engineer, decompile, or disassemble any part of the Service.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
              <li>Upload or transmit malicious code, viruses, or any other harmful technology.</li>
            </ol>
            <p>
              Violation of these terms may result in immediate termination of your account
              without refund.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Intellectual Property</h2>
            <p>
              The Service, including its original content (excluding user-generated content),
              features, and functionality, is and will remain the exclusive property of
              TenderBazaar Technologies Private Limited. Our trademarks, trade names, logos,
              and service marks may not be used in connection with any product or service
              without prior written consent.
            </p>
            <p>
              The underlying tender data sourced from government portals is public
              information. However, our aggregation, organisation, AI-powered analysis, and
              presentation of such data constitute our proprietary work product.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">7. Disclaimer</h2>
            <p>
              TenderBazaar aggregates tender information from third-party government
              portals. While we strive for accuracy, we do not guarantee that the
              information displayed on our platform is complete, accurate, or up-to-date.
            </p>
            <p>
              <strong className="text-foreground">You acknowledge and agree that:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>
                Tender information should always be verified with the original issuing
                authority before taking any action.
              </li>
              <li>
                AI-powered eligibility assessments are indicative and not definitive. They
                should not be treated as legal or professional advice.
              </li>
              <li>
                TenderBazaar is not responsible for any decisions made based on the
                information provided through the Service.
              </li>
            </ol>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, TenderBazaar Technologies
              Private Limited shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages, including but not limited to loss of
              profits, data, business opportunities, or goodwill, arising out of or in
              connection with your use of the Service.
            </p>
            <p>
              Our total aggregate liability for any claims arising from or related to the
              Service shall not exceed the amount you paid to us in the twelve (12) months
              preceding the claim.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">9. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of
              India. Any disputes arising out of or relating to these Terms or the Service
              shall be subject to the exclusive jurisdiction of the courts located in
              Ahmedabad, Gujarat, India.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">10. Contact Information</h2>
            <p>If you have any questions about these Terms, please contact us at:</p>
            <ul className="list-none space-y-1 ml-2">
              <li>
                <strong className="text-foreground">Email:</strong>{' '}
                <a href="mailto:legal@tenderbazaar.com" className="text-primary-400 hover:text-primary-300 transition-colors">
                  legal@tenderbazaar.com
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
