import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Wealth Vault",
  description: "The terms governing your use of Wealth Vault.",
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-800 dark:text-slate-100">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated: September 20, 2026</p>

      <p className="mt-8">
        These Terms of Service ("Terms") govern your access to and use of Wealth Vault (the "Service"),
        operated by an individual developer, Rahul Singh ("we," "us," or "our"). By creating an account
        or using the Service, you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2 className="mt-10 text-xl font-semibold">1. The Service</h2>
      <p className="mt-3">
        Wealth Vault is a personal wealth-tracking application that lets you record and view
        investment and asset information — stocks, mutual funds, deposits, crypto, and similar
        holdings — in one place. The Service is provided for personal, informational use and is not
        financial, investment, tax, or legal advice.
      </p>

      <h2 className="mt-10 text-xl font-semibold">2. Accounts</h2>
      <p className="mt-3">
        You sign in to the Service using a third-party provider (Google, Apple, LinkedIn, or X). You
        are responsible for maintaining the security of that third-party account, and for all activity
        that occurs under your Wealth Vault account. Notify us promptly at the email below if you
        suspect unauthorized access.
      </p>

      <h2 className="mt-10 text-xl font-semibold">3. Your Passphrase and Encrypted Data</h2>
      <p className="mt-3">
        Portfolio data you enter is encrypted on your device using a key derived from a passphrase you
        choose, before it is sent to our servers. We never receive or store your passphrase, and we
        cannot decrypt, view, or recover your portfolio data on your behalf.
      </p>
      <p className="mt-3">
        <strong>If you lose or forget your passphrase, your encrypted portfolio data cannot be
        recovered by us or by anyone else, under any circumstances.</strong> You are solely responsible
        for remembering or securely storing your passphrase.
      </p>

      <h2 className="mt-10 text-xl font-semibold">4. Subscriptions and Billing</h2>
      <p className="mt-3">
        Certain features of the Service require a paid subscription. Subscription payments are
        processed by Razorpay, a third-party payment processor; we do not receive or store your raw
        payment card or bank details. Subscription plans, pricing, billing cycles, and cancellation
        terms are as displayed in the Service at the time of purchase and may change with notice. You
        may cancel your subscription at any time; cancellation takes effect at the end of the current
        billing cycle unless stated otherwise.
      </p>

      <h2 className="mt-10 text-xl font-semibold">5. Acceptable Use</h2>
      <p className="mt-3">You agree not to:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
        <li>Attempt to gain unauthorized access to the Service, other users' accounts, or our systems.</li>
        <li>Interfere with or disrupt the integrity or performance of the Service.</li>
        <li>Reverse-engineer, decompile, or attempt to extract the source code of the Service, except as permitted by law.</li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold">6. Data Accuracy</h2>
      <p className="mt-3">
        The Service displays information based on data you enter yourself. We do not independently
        verify the accuracy of the values, prices, or holdings you record, and are not responsible for
        decisions made based on that information.
      </p>

      <h2 className="mt-10 text-xl font-semibold">7. No Financial Advice</h2>
      <p className="mt-3">
        Nothing in the Service constitutes financial, investment, tax, or legal advice. Any decisions
        you make regarding your investments or finances are made at your own discretion and risk.
      </p>

      <h2 className="mt-10 text-xl font-semibold">8. Disclaimer of Warranties</h2>
      <p className="mt-3">
        The Service is provided "as is" and "as available," without warranties of any kind, express or
        implied, including but not limited to warranties of merchantability, fitness for a particular
        purpose, or non-infringement. We do not warrant that the Service will be uninterrupted,
        error-free, or secure from all possible threats.
      </p>

      <h2 className="mt-10 text-xl font-semibold">9. Limitation of Liability</h2>
      <p className="mt-3">
        To the fullest extent permitted by law, we shall not be liable for any indirect, incidental,
        special, consequential, or punitive damages, or any loss of data, profits, or revenue, arising
        from or related to your use of (or inability to use) the Service — including, without
        limitation, any loss resulting from a forgotten or lost passphrase.
      </p>

      <h2 className="mt-10 text-xl font-semibold">10. Termination</h2>
      <p className="mt-3">
        You may stop using the Service and request deletion of your account at any time by contacting
        us. We may suspend or terminate your access to the Service if you violate these Terms.
      </p>

      <h2 className="mt-10 text-xl font-semibold">11. Changes to These Terms</h2>
      <p className="mt-3">
        We may update these Terms from time to time. The "Last updated" date above reflects the most
        recent revision. Continued use of the Service after a change constitutes acceptance of the
        updated Terms.
      </p>

      <h2 className="mt-10 text-xl font-semibold">12. Governing Law</h2>
      <p className="mt-3">
        These Terms are governed by the laws of India, without regard to conflict-of-law principles,
        regardless of your country of residence.
      </p>

      <h2 className="mt-10 text-xl font-semibold">13. Contact Us</h2>
      <p className="mt-3">
        Questions about these Terms can be sent to{" "}
        <a className="underline" href="mailto:rahulsingh2k10@gmail.com">
          rahulsingh2k10@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
