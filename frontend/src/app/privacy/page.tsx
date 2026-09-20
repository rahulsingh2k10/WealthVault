import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Wealth Vault",
  description: "How Wealth Vault collects, uses, and protects your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-800 dark:text-slate-100">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Last updated: September 20, 2026</p>

      <p className="mt-8">
        Wealth Vault ("we," "us," or "our") is operated by an individual developer, Rahul Singh. This
        policy explains what information Wealth Vault collects, how it is used, and the choices you
        have. Wealth Vault is a personal wealth-tracking application; protecting your data is a core
        part of how it is designed, not an afterthought.
      </p>

      <h2 className="mt-10 text-xl font-semibold">1. Information We Collect</h2>
      <p className="mt-3">
        <strong>Account information from sign-in providers.</strong> When you sign in with Google,
        Apple, LinkedIn, or X (Twitter), we receive basic profile information from that provider: your
        name, an email address (or, for X, your handle), and a profile photo/avatar. We do not receive
        or store your password for these providers — authentication is handled entirely by the
        provider.
      </p>
      <p className="mt-3">
        <strong>Account and preference data.</strong> We store your full name, username (your email or
        X handle), avatar, which provider you signed in with, your subscription plan, and preferences
        such as country, locale, and theme.
      </p>
      <p className="mt-3">
        <strong>Portfolio and financial data.</strong> If you add investment or asset records (stocks,
        funds, deposits, crypto, etc.), that data is encrypted on your device before it is ever sent to
        our servers, using a key derived from a passphrase that only you know. We store only the
        encrypted result. Your passphrase itself is never transmitted to us or stored anywhere — as a
        result, we cannot read, decrypt, or recover the contents of your portfolio data. If you forget
        your passphrase, this data cannot be recovered by us.
      </p>
      <p className="mt-3">
        <strong>Billing information.</strong> Subscription payments are processed by Razorpay, a
        third-party payment processor. We store your subscription status, plan, and a Razorpay
        customer/subscription identifier. We do not receive or store your card, UPI, or other raw
        payment details — Razorpay handles that directly.
      </p>

      <h2 className="mt-10 text-xl font-semibold">2. How We Use Your Information</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>To create and secure your account, and to authenticate you on future visits.</li>
        <li>To operate the core features of the app, including storing and displaying your portfolio (in encrypted form) and preferences.</li>
        <li>To process subscription payments and manage your billing status via Razorpay.</li>
        <li>To communicate with you about your account, such as support requests you initiate.</li>
      </ul>
      <p className="mt-3">
        We do not use your data for advertising, and we do not run any advertising or behavioral
        tracking network on Wealth Vault. We do not sell your personal information to any third party.
      </p>

      <h2 className="mt-10 text-xl font-semibold">3. Third-Party Services</h2>
      <p className="mt-3">Wealth Vault relies on the following third parties to operate:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li><strong>Google, Apple, LinkedIn, and X</strong> — for authentication (sign-in) only.</li>
        <li><strong>Razorpay</strong> — for processing subscription payments.</li>
      </ul>
      <p className="mt-3">
        Each of these providers has its own privacy policy governing how it handles your information.
        We encourage you to review them directly.
      </p>

      <h2 className="mt-10 text-xl font-semibold">4. Data Storage and Security</h2>
      <p className="mt-3">
        Account data is stored on secured, access-controlled database infrastructure. Your portfolio
        and financial records are stored using client-side, zero-knowledge encryption (AES-256-GCM,
        with the encryption key derived from your passphrase) — meaning that even in the event of a
        server-side data breach, your portfolio contents would remain encrypted and unreadable without
        your passphrase, which we never possess.
      </p>

      <h2 className="mt-10 text-xl font-semibold">5. Data Retention and Deletion</h2>
      <p className="mt-3">
        We retain your account and portfolio data for as long as your account remains active. You may
        request deletion of your account and associated data at any time by contacting us at the email
        below. Once we confirm your request, your account data and encrypted portfolio records will be
        permanently deleted from our systems, other than records we are legally required to retain
        (for example, billing records required for tax or accounting purposes).
      </p>

      <h2 className="mt-10 text-xl font-semibold">6. Your Rights</h2>
      <p className="mt-3">
        Depending on where you live, you may have rights to access, correct, export, or delete your
        personal information, and to object to or restrict certain processing (for example, under the
        GDPR if you are in the EU/UK, or the CCPA if you are a California resident). You can exercise
        any of these rights by contacting us at the email below; we will respond within a reasonable
        time.
      </p>

      <h2 className="mt-10 text-xl font-semibold">7. International Users</h2>
      <p className="mt-3">
        Wealth Vault is operated from India, and your information may be processed and stored there.
        By using the app, you consent to this transfer and processing, wherever you are located.
      </p>

      <h2 className="mt-10 text-xl font-semibold">8. Children's Privacy</h2>
      <p className="mt-3">
        Wealth Vault is not directed to children under 16, and we do not knowingly collect information
        from them. If you believe a child has provided us with personal information, please contact us
        so we can remove it.
      </p>

      <h2 className="mt-10 text-xl font-semibold">9. Changes to This Policy</h2>
      <p className="mt-3">
        We may update this policy from time to time as the app evolves. The "Last updated" date at the
        top of this page reflects the most recent revision. Continued use of Wealth Vault after a
        change constitutes acceptance of the updated policy.
      </p>

      <h2 className="mt-10 text-xl font-semibold">10. Contact Us</h2>
      <p className="mt-3">
        If you have questions about this policy or wish to exercise any of your data rights, contact us
        at{" "}
        <a className="underline" href="mailto:rahulsingh2k10@gmail.com">
          rahulsingh2k10@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
