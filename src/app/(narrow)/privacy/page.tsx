import type { Metadata } from "next";
import { Clause, LegalPage, OPERATOR } from "@/components/common/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "FinTalk Privacy Policy",
  alternates: { canonical: "/privacy" },
};

// LEGAL REVIEW REQUIRED: this is a draft. Check GDPR / UK GDPR / CCPA and other local requirements before targeting those regions.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-muted-foreground">
        {OPERATOR.name} (the “Operator”) provides the {OPERATOR.service} service. This Privacy Policy explains what personal information we collect, why we collect it and how
        you can control it.
      </p>

      <Clause title="1. Information we collect">
        <ul>
          <li>At sign-up: email address, password (stored hashed) and nickname.</li>
          <li>Profile (optional): bio, profile photo, interests and notification settings.</li>
          <li>Contest entry: OKX UID and country of residence.</li>
          <li>Content you create: posts, comments, images, upvotes, saves, follows, watchlist, reports, notifications, Contribution metrics and paper trading activity.</li>
          <li>Collected automatically: access logs, IP address, approximate location (country) derived from your IP, browser and device information, and cookies, for security and reliable operation.</li>
        </ul>
        <p>We collect information that you enter yourself and information generated automatically when you use the Service.</p>
      </Clause>

      <Clause title="2. How we use information">
        <ul>
          <li>Account registration, login, identity checks, account management and abuse prevention.</li>
          <li>Providing boards, questions and answers, follows, notifications and paper trading.</li>
          <li>Calculating Contribution, leaderboards and other in-service statistics.</li>
          <li>Running Contests: verifying your OKX UID and eligibility, enforcing country restrictions, detecting multiple accounts and paying prizes.</li>
          <li>Handling reports and restrictions, resolving disputes, improving the Service, analysing errors and security issues, and responding to enquiries.</li>
        </ul>
      </Clause>

      <Clause title="3. Retention">
        <p>
          We delete your personal information promptly when you delete your account. Your posts and comments are deleted with the account and cannot be restored. We keep
          information that we are legally required to retain for the legally required period. Logs of blocked or rejected Contest entries (country and timestamp) are kept for
          audit purposes for up to 12 months.
        </p>
        <p>The minimum information needed to prevent a restricted User from re-registering may be kept for the duration of the restriction.</p>
      </Clause>

      <Clause title="4. Sharing">
        <p>
          We use your information only for the purposes described here and do not sell it. We share it with third parties only with your consent, where the law requires it
          (for example a lawful request from authorities), or with the service providers listed below.
        </p>
        <p>Your nickname, profile photo, bio and interests, and your Contest ranking if you take part, are visible to other Users and visitors.</p>
        <p>
          Contest eligibility checks may involve confirming your OKX UID against the Operator&apos;s referral records with OKX. We do not receive your OKX password or funds.
        </p>
      </Clause>

      <Clause title="5. Service providers and international transfers">
        <ul>
          <li>Supabase Inc. — authentication, database and file storage (all account and usage data).</li>
          <li>Web hosting, deployment and CDN providers — operating the Service and processing access logs.</li>
        </ul>
        <p>
          These providers may process data on servers outside your country. By using the Service you understand that your data is transferred over the network to those
          servers. If you do not want this, please do not register, or delete your account.
        </p>
      </Clause>

      <Clause title="6. Your rights">
        <ul>
          <li>You can view and edit your nickname, bio, profile photo and notification settings under My page → Settings.</li>
          <li>You can delete your account and personal data with “Delete account” under My page → Settings.</li>
          <li>
            You can ask us to access, correct, delete, restrict or export your data, or object to processing, by emailing the contact address below. Depending on where you live
            you may also have the right to complain to your local data protection authority.
          </li>
        </ul>
      </Clause>

      <Clause title="7. Cookies and browser storage">
        <p>
          We use an authentication cookie to keep you logged in. Your theme choice and unsaved post drafts are stored in your browser (localStorage). You can block cookies in your
          browser settings, but some features such as login will not work.
        </p>
      </Clause>

      <Clause title="8. Security">
        <ul>
          <li>Passwords are stored hashed; the Operator cannot see the original password.</li>
          <li>Access to data is minimised and row-level security (RLS) prevents unauthorised access to your records.</li>
          <li>Data in transit is encrypted with HTTPS.</li>
        </ul>
      </Clause>

      <Clause title="9. Children">
        <p>The Service is not intended for anyone under 18, and we do not knowingly collect personal information from minors.</p>
      </Clause>

      <Clause title="10. Contact">
        <ul>
          <li>Privacy officer: {OPERATOR.ceo} (Representative)</li>
          <li>Email: {OPERATOR.email}</li>
          <li>Company: {OPERATOR.name} / Business registration no.: {OPERATOR.regNo}</li>
          <li>Address: {OPERATOR.address}</li>
        </ul>
      </Clause>

      <Clause title="11. Changes to this policy">
        <p>We will announce changes in the Service at least 7 days before they take effect, and 30 days before for changes that materially affect your rights.</p>
      </Clause>

      <p className="text-xs text-muted-foreground">This policy takes effect on {OPERATOR.effective}.</p>
    </LegalPage>
  );
}
