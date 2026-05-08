import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  const updatedOn = 'April 26, 2026';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto max-w-4xl px-4 py-10 md:py-14">
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold md:text-4xl">Privacy Policy</h1>
          <Link
            to="/"
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-orange-500"
          >
            Back to Home
          </Link>
        </div>

        <p className="mb-8 text-sm text-muted-foreground">Last Updated: {updatedOn}</p>

        <div className="space-y-8 text-sm leading-7 md:text-base">
          <section>
            <h2 className="mb-2 text-xl font-semibold">1. Overview</h2>
            <p>
              CheckPay helps users verify and track payment transactions. This policy explains what data
              we collect, how we use it, and what choices users have.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">2. Information We Collect</h2>
            <p className="mb-2">Depending on product features enabled, we may process:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Account information such as phone number, name, and authentication details.</li>
              <li>Transaction metadata such as amount, sender label, bank/institution, and timestamps.</li>
              <li>Device and app identifiers used for security, fraud prevention, and service reliability.</li>
              <li>
                SMS content only for transaction extraction when users enable SMS auto-import and grant
                required Android permissions/roles.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">3. SMS Access and User Control</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>SMS auto-import is optional.</li>
              <li>
                If users do not enable required permissions/roles, CheckPay remains usable in manual mode.
              </li>
              <li>SMS is processed to identify and structure transaction records.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">4. How We Use Data</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>Provide transaction verification and monitoring features.</li>
              <li>Generate analytics and insights for users and businesses.</li>
              <li>Protect accounts, detect abuse, and maintain service quality.</li>
              <li>Comply with legal and regulatory obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">5. Data Sharing</h2>
            <p>
              We do not sell personal data. We may share limited data with service providers that help us
              operate authentication, infrastructure, notifications, analytics, and security controls under
              contractual protections.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">6. Security</h2>
            <p>
              We use technical and organizational safeguards, including encryption in transit and access
              controls. No system is perfectly secure, but we continuously improve our protections.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">7. Data Retention and Deletion</h2>
            <p>
              We retain data only as needed for product functionality, legal obligations, and security.
              Users can request deletion of eligible personal data by contacting support.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-semibold">8. Contact</h2>
            <p>
              For privacy questions or deletion requests, contact:
              <a className="ml-1 text-orange-500 hover:text-orange-400" href="mailto:hello@checkpay.africa">
                hello@checkpay.africa
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
