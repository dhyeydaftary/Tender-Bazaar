import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description:
    'TenderBazaar refund policy — clear and transparent guidelines for subscription refunds.',
  openGraph: {
    title: 'Refund Policy | TenderBazaar',
    description:
      'TenderBazaar refund policy — clear and transparent guidelines for subscription refunds.',
  },
};

export default function RefundPage() {
  return (
    <div className="bg-background pt-32 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-foreground">Refund Policy</h1>
          <p className="mt-3 text-muted-foreground">Last updated: April 2026</p>
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none space-y-10 text-foreground/80 leading-relaxed">
          <p>
            At TenderBazaar, we want you to be fully satisfied with your subscription. This
            Refund Policy outlines our guidelines for refunds on paid subscription plans.
          </p>

          {/* Eligibility */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">Refund Eligibility</h2>

            <h3 className="text-lg font-medium text-foreground mt-4">7-Day Refund Window</h3>
            <p>
              New subscribers to any paid plan (Starter, Professional, or Enterprise) are
              eligible for a <strong className="text-foreground">full refund within 7 days</strong> of
              their initial purchase, provided that usage has been minimal. This gives you
              sufficient time to evaluate whether TenderBazaar meets your business needs.
            </p>

            <h3 className="text-lg font-medium text-foreground mt-4">Annual Plan Pro-Rated Refunds</h3>
            <p>
              If you are on an annual plan and wish to cancel after the 7-day window, you
              may be eligible for a <strong className="text-foreground">pro-rated refund</strong> for the
              remaining unused months. The refund amount is calculated based on the monthly
              equivalent rate, not the discounted annual rate.
            </p>

            <h3 className="text-lg font-medium text-foreground mt-4">Monthly Plans</h3>
            <p>
              Monthly subscriptions cancelled after the 7-day window are not eligible for
              refunds. Your subscription will remain active until the end of the current
              billing period.
            </p>
          </section>

          {/* Non-refundable */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">Non-Refundable Items</h2>
            <p>The following are not eligible for refunds:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className="text-foreground">Consumed usage-based features:</strong> AI
                eligibility checks, tender views, and other usage-based features that have
                already been consumed during the billing period.
              </li>
              <li>
                <strong className="text-foreground">Free plan:</strong> The Free plan does not involve
                any payment and is not subject to this policy.
              </li>
              <li>
                <strong className="text-foreground">Renewals after 7 days:</strong> Automatic renewal
                charges are not eligible for refund if a cancellation request was not
                submitted before the renewal date.
              </li>
            </ul>
          </section>

          {/* How to request */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">How to Request a Refund</h2>
            <p>To request a refund, follow these steps:</p>
            <ol className="list-decimal list-inside space-y-3 ml-2">
              <li>
                <strong className="text-foreground">Email us</strong> at{' '}
                <a href="mailto:billing@tenderbazaar.com" className="text-primary-400 hover:text-primary-300 transition-colors">
                  billing@tenderbazaar.com
                </a>{' '}
                with the subject line &quot;Refund Request&quot;.
              </li>
              <li>
                Include your <strong className="text-foreground">registered email address</strong>, the{' '}
                <strong className="text-foreground">plan name</strong>, and the{' '}
                <strong className="text-foreground">reason for your refund request</strong>.
              </li>
              <li>
                Our billing team will review your request and respond within{' '}
                <strong className="text-foreground">2 business days</strong>.
              </li>
              <li>
                If approved, the refund will be processed to your original payment method.
              </li>
            </ol>
          </section>

          {/* Processing time */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">Processing Time</h2>
            <p>Once your refund is approved:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <strong className="text-foreground">Credit/Debit Card:</strong> Refunds typically
                appear within 5&ndash;7 business days, depending on your bank.
              </li>
              <li>
                <strong className="text-foreground">UPI:</strong> Refunds are processed within
                3&ndash;5 business days.
              </li>
              <li>
                <strong className="text-foreground">Net Banking:</strong> Refunds may take up to
                7&ndash;10 business days.
              </li>
            </ul>
            <p className="mt-3">
              Please note that processing times may vary based on your payment provider and
              bank. If you do not receive your refund within the stated timeframe, please
              contact your bank first, then reach out to us.
            </p>
          </section>

          {/* Account status */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">Account Status After Refund</h2>
            <p>
              Upon processing a refund, your account will be downgraded to the Free plan.
              You will retain access to your account data, saved tenders, and alerts within
              the limits of the Free plan.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-foreground">Questions?</h2>
            <p>
              If you have any questions about our Refund Policy, please{' '}
              <Link href="/contact" className="text-primary-400 hover:text-primary-300 transition-colors">
                contact us
              </Link>{' '}
              or email{' '}
              <a href="mailto:billing@tenderbazaar.com" className="text-primary-400 hover:text-primary-300 transition-colors">
                billing@tenderbazaar.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
