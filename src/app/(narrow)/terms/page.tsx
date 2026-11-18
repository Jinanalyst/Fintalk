import type { Metadata } from "next";
import { Clause, LegalPage, OPERATOR } from "@/components/common/legal";
import { BLOCKED_COUNTRIES, COUNTRIES } from "@/lib/contest";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Chainlabs Terms of Service",
  alternates: { canonical: "/terms" },
};

const restricted = BLOCKED_COUNTRIES.map((c) => COUNTRIES.find((x) => x.code === c)?.name ?? c).join(", ");

// LEGAL REVIEW REQUIRED: this is a draft. Have it reviewed by qualified counsel before publishing the contest.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <Clause title="1. Purpose">
        <p>
          These Terms govern your use of {OPERATOR.service} (the “Service”), an investing community and paper trading platform operated by{" "}
          {OPERATOR.name} (the “Operator”). By using the Service you agree to these Terms.
        </p>
      </Clause>

      <Clause title="2. Definitions">
        <ul>
          <li>“User” means anyone who uses the Service, whether or not registered.</li>
          <li>“Member” means a User who has created an account, for example with an email address.</li>
          <li>“Content” means posts, comments, images, ticker tags and any other material a User submits.</li>
          <li>“Contribution” means an activity score shown in the Service (posts, answers, accepted answers, upvotes and so on).</li>
          <li>“Contest” means a free paper trading competition run on the Service.</li>
        </ul>
      </Clause>

      <Clause title="3. Changes to these Terms">
        <p>
          The Operator may update these Terms within the limits of applicable law. Changes are announced in the Service at least 7 days before they take
          effect (30 days for changes that are unfavorable to Users). Continued use after the effective date means you accept the updated Terms.
        </p>
      </Clause>

      <Clause title="4. Accounts">
        <ul>
          <li>You must provide accurate information and keep your password secure. You are responsible for activity on your account.</li>
          <li>You must be at least 18 years old to create an account.</li>
          <li>The Operator may refuse registration or restrict an account that uses another person&apos;s information or false information.</li>
          <li>You may delete your account at any time from My page. Deleting your account permanently removes your posts and comments.</li>
        </ul>
      </Clause>

      <Clause title="5. The Service">
        <p>
          The Service includes discussion boards, questions and answers, insights, creator following, notifications, contribution records and paper trading.
          The Operator may change or suspend all or part of the Service when operationally or technically necessary and will announce important changes in advance
          where possible.
        </p>
      </Clause>

      <Clause title="6. Not financial advice; paper trading only">
        <ul>
          <li>Content in the Service consists of the personal opinions of Users. The Operator does not guarantee its accuracy, completeness or timeliness.</li>
          <li>Nothing in the Service is investment advice, a recommendation or a solicitation. You alone are responsible for your investment decisions and their results.</li>
          <li>Paper trading uses virtual funds only. Results are simulated, do not represent real trading, and may differ greatly from real market execution.</li>
          <li>The Operator is not a party to any transaction between Users or between a User and a third party.</li>
        </ul>
      </Clause>

      <Clause title="7. Content and licence">
        <ul>
          <li>You keep ownership of your Content and are responsible for it.</li>
          <li>
            You grant the Operator a free, non-exclusive licence to display, reproduce and format your Content within the Service (for example in search results,
            summaries and previews). The licence ends when you delete the Content or your account, except for portions already shared or quoted by other Users.
          </li>
          <li>You must clearly disclose sponsorship, paid promotion and any conflict of interest in your Content.</li>
        </ul>
      </Clause>

      <Clause title="8. Prohibited conduct">
        <p>You must not:</p>
        <ul>
          <li>spread false or exaggerated information, or post to manipulate the price of an asset (pump-and-dump, paid signal-group recruiting and similar);</li>
          <li>pose as an investment manager or advisor, or promise profits in exchange for money;</li>
          <li>collect or publish other people&apos;s personal data, harass others, or post hateful or defamatory material;</li>
          <li>post Content that infringes the rights of others;</li>
          <li>post spam or advertising repeatedly, or use multiple accounts or automation to manipulate votes, views, Contribution or Contest rankings;</li>
          <li>disrupt the Service, bypass its security or geographic restrictions, or break applicable law.</li>
        </ul>
      </Clause>

      <Clause title="9. Moderation">
        <p>
          The Operator may hide or delete Content that is reported or that appears to violate these Terms, and may restrict or suspend accounts depending on the severity.
          Where possible we will explain the reason, and you may object using the contact details below.
        </p>
      </Clause>

      <Clause title="10. Contribution and rewards">
        <p>
          Contribution is an activity indicator. It is not currently linked to cash or cash-equivalent rewards. If a rewards program is introduced, its rules will be announced in advance.
          The way Contribution is calculated may change to prevent abuse and improve the Service.
        </p>
      </Clause>

      <Clause title="11. Trading Contests">
        <ul>
          <li>
            <b>Free to enter.</b> No purchase or payment is necessary to enter or win a Contest. Contests use virtual funds only; no real money is traded.
          </li>
          <li>
            <b>Eligibility.</b> You must be at least 18 years old and must not be a resident of a restricted country. Restricted countries currently include: {restricted}, and
            any other country or region where the services of our exchange partner (OKX) are not available. We may block access by IP address and may reject entries based on your declared country of residence.
          </li>
          <li>
            <b>Residents of South Korea are not eligible</b> to enter any Contest or receive any prize.
          </li>
          <li>
            <b>OKX UID verification.</b> To enter, you must register an account on OKX using the Operator&apos;s referral link and submit your OKX UID. One account per person and one
            OKX UID per account. The Operator may verify your UID manually or through OKX tools and may reject or disqualify entries it cannot verify.
          </li>
          <li>
            <b>Affiliate disclosure.</b> The Operator may receive a commission from OKX when you register through its referral link. This does not cost you anything.
            The Operator is not affiliated with, endorsed by or sponsored by OKX, and OKX is not a sponsor of or responsible for any Contest.
          </li>
          <li>
            <b>Rules and prizes.</b> Contest period, scoring, prize amounts and payout conditions are published in the Contest rules before it starts. Prizes may be subject to identity
            checks, a minimum number of trades, risk limits and administrator review. Winners are responsible for any taxes that apply to them.
          </li>
          <li>
            <b>Fair play.</b> Multiple accounts, collusion, exploiting bugs, price-feed manipulation, or any use of VPNs or other means to hide your location may result in
            disqualification and forfeiture of prizes. The Operator&apos;s decisions on rankings and disqualification are final.
          </li>
          <li>The Operator may modify, suspend or cancel a Contest at any time, including for legal or regulatory reasons.</li>
        </ul>
      </Clause>

      <Clause title="12. Advertising and third-party links">
        <p>
          The Service may show advertising or links to third-party websites, including referral links. The Operator does not endorse or guarantee third-party products or services, and
          ad clicks are not counted toward Contribution.
        </p>
      </Clause>

      <Clause title="13. Disclaimer and limitation of liability">
        <ul>
          <li>The Service is provided “as is”. The Operator is not liable for interruptions caused by events beyond its reasonable control, such as outages of networks, servers or data providers.</li>
          <li>The Operator is not liable for disputes between Users or between a User and a third party arising from Content.</li>
          <li>Nothing in these Terms limits liability that cannot be limited under applicable law, including liability for willful misconduct or gross negligence.</li>
        </ul>
      </Clause>

      <Clause title="14. Governing law">
        <p>
          These Terms are governed by the laws of the Republic of Korea, without prejudice to any mandatory consumer protection rules of your country of residence. Disputes will
          be resolved by the competent courts under applicable law. {/* LEGAL REVIEW REQUIRED: confirm governing law and venue for international Users. */}
        </p>
      </Clause>

      <Clause title="Operator and contact">
        <ul>
          <li>Company: {OPERATOR.name} / Representative: {OPERATOR.ceo}</li>
          <li>Business registration no.: {OPERATOR.regNo}</li>
          <li>Address: {OPERATOR.address}</li>
          <li>Email: {OPERATOR.email}</li>
        </ul>
      </Clause>

      <p className="text-xs text-muted-foreground">These Terms take effect on {OPERATOR.effective}.</p>
    </LegalPage>
  );
}
