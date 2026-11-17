import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { APP_CONFIG } from '@/lib/constants';
import {
  ShieldCheck,
  Lock,
  FileText,
  UserCheck,
  ChevronRight,
  ArrowLeft,
  Mail,
  AlertTriangle,
  Building,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | VPark',
  description: 'Privacy policy and personal data protection disclosures for VPark.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrivacyPolicyPage() {
  const lastUpdated = 'November 17, 2026';

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#07090E] text-slate-900 dark:text-slate-100 flex flex-col justify-between font-sans transition-colors duration-200">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B0C10] border-b border-neutral-800 text-white select-none">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 focus-visible:outline-none">
            <VParkLogo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Breadcrumbs Navigation */}
      <div className="border-b border-slate-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-xs">
        <nav aria-label="Breadcrumb" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <ol className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <li>
              <Link href="/" className="hover:text-[#0A5CFF] transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </li>
            <li className="font-semibold text-slate-900 dark:text-white" aria-current="page">
              Privacy Policy
            </li>
          </ol>
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        {/* Title & Metadata */}
        <div className="space-y-3 pb-6 border-b border-slate-200 dark:border-neutral-800">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0A5CFF] border border-blue-200 dark:border-blue-900/60 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Digital Personal Data Protection Act, 2023 (India)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            VPark Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Last Updated: {lastUpdated} · Version: {APP_CONFIG.legalDocVersions.privacy}
          </p>
        </div>

        {/* Notice Banner */}
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs sm:text-sm leading-relaxed flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Legal Notice &amp; Scope:</span> This Privacy Policy describes how
            VPark (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) processes personal data collected
            through our smart parking platform in the Bengaluru pilot micro-market. Specific details such as
            corporate incorporation and registration numbers are pending final legal review and formal incorporation.
          </div>
        </div>

        {/* Sections */}
        <article className="prose dark:prose-invert max-w-none space-y-8 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#0A5CFF] inline-flex items-center justify-center text-xs font-bold">
                1
              </span>
              <span>Information We Collect</span>
            </h2>
            <p>
              VPark operates a two-sided parking marketplace for drivers and parking space providers. We collect
              only the minimum necessary personal identifiers required to facilitate parking reservations,
              process payments, and verify right-to-rent documents:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Driver Information:</strong> Phone numbers (E.164 normalized), full names, vehicle
                registration plate numbers, vehicle classifications (Sedan, Hatchback, SUV, 2W, EV), and session
                check-in logs.
              </li>
              <li>
                <strong>Provider &amp; Space Owner Information:</strong> Phone numbers, bank account/UPI payout
                identifiers, parking space geographic coordinates and street addresses, and right-to-rent verification
                documents (sale deeds, electricity/tax bills, or RWA society NOC letters).
              </li>
              <li>
                <strong>Transactional &amp; Session Records:</strong> Reservation holds, booking reference codes,
                Razorpay payment references, session timestamps, and encrypted OTP challenges.
              </li>
              <li>
                <strong>Technical Diagnostics:</strong> IP addresses, browser user-agent strings, and security audit
                logs for fraud and overbooking prevention.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#0A5CFF] inline-flex items-center justify-center text-xs font-bold">
                2
              </span>
              <span>Purpose of Data Processing</span>
            </h2>
            <p>We process personal identifiers under clear, lawful purposes:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Providing guaranteed, unconflicted parking reservations and 10-minute slot holds.</li>
              <li>Facilitating secure contactless entry and parking gate instructions.</li>
              <li>Executing split settlements (host payouts and platform commission reconciliation).</li>
              <li>Administering trust, safety, and dispute resolution within 4-hour SLA response times.</li>
              <li>
                Complying with statutory accounting, GST tax invoicing, and Indian DPDP Act 2023 requirements.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#0A5CFF] inline-flex items-center justify-center text-xs font-bold">
                3
              </span>
              <span>Data Security &amp; Encryption</span>
            </h2>
            <p>
              We apply technical and organizational safeguards to ensure data integrity and confidentiality:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Salted SHA-256 OTP Verification:</strong> Authentication codes are never stored in plaintext.
                Verification uses constant-time comparisons (`crypto.timingSafeEqual`) to eliminate side-channel timing risks.
              </li>
              <li>
                <strong>Confidential Document Storage:</strong> Right-to-rent documents (sale deeds and society NOCs)
                are held in isolated private directories accessible only by the document uploader and audited admins.
              </li>
              <li>
                <strong>Secure Session Cookies:</strong> Cookies are marked `HttpOnly`, `SameSite=Lax`, and `Secure`
                in production to prevent XSS and cross-origin state tampering.
              </li>
              <li>
                <strong>Phone Number Masking:</strong> Drivers and providers communicate through masked phone identifiers
                where available to prevent unsolicited contact.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#0A5CFF] inline-flex items-center justify-center text-xs font-bold">
                4
              </span>
              <span>User Rights Under India DPDP Act, 2023</span>
            </h2>
            <p>
              In accordance with the Digital Personal Data Protection Act, 2023, you have the following enforceable rights:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Right to Information &amp; Summary:</strong> You may request an itemized export of your profile,
                vehicles, booking history, and active consents via our in-app Data Export Terminal or by visiting{' '}
                <a href="/api/user/export" download className="text-[#0A5CFF] underline">
                  /api/user/export
                </a>
                .
              </li>
              <li>
                <strong>Right to Correction &amp; Erasure:</strong> You can update vehicle details or trigger statutory
                account soft-deletion under DPDP Act provisions. Upon deletion, your full name is scrubbed and personal
                identifiers are permanently decoupled.
              </li>
              <li>
                <strong>Right of Grievance Redressal:</strong> Any privacy grievances will be acknowledged within 24 hours
                and investigated by our designated Data Protection Grievance Officer.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#0A5CFF] inline-flex items-center justify-center text-xs font-bold">
                5
              </span>
              <span>Third-Party Service Providers</span>
            </h2>
            <p>
              VPark integrates with trusted third-party services strictly as required for platform functionality:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Payment Processing:</strong> Razorpay (UPI, Netbanking, Cards) for PCI-DSS compliant payment collection.
              </li>
              <li>
                <strong>Mapping &amp; Navigation:</strong> Google Maps JavaScript API for parking location rendering and driving directions.
              </li>
              <li>
                <strong>Analytics:</strong> Google Analytics 4 (anonymized IP configuration) to monitor platform health and conversion flows.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#0A5CFF] inline-flex items-center justify-center text-xs font-bold">
                6
              </span>
              <span>Contact &amp; Grievance Redressal</span>
            </h2>
            <p>
              For privacy inquiries, data subject access requests, or regulatory questions, reach out to our team:
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">
                VPark Data Protection &amp; Grievance Desk
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Email:{' '}
                <a href={`mailto:${APP_CONFIG.contactEmail}`} className="text-[#0A5CFF] underline">
                  {APP_CONFIG.contactEmail}
                </a>
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Helpline: {APP_CONFIG.contactPhone} (Mon–Sat, 09:00–18:00 IST)
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Location: Yelahanka New Town, Bengaluru, Karnataka 560064, India
              </p>
            </div>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <p>© {new Date().getFullYear()} VPark · Yelahanka Pilot Micro-Market</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-[#0A5CFF] transition-colors">
              Home
            </Link>
            <Link href="/contact" className="hover:text-[#0A5CFF] transition-colors">
              Contact
            </Link>
            <Link href="/driver/home" className="hover:text-[#0A5CFF] transition-colors">
              Find Parking
            </Link>
            <Link href="/owner/dashboard" className="hover:text-[#0A5CFF] transition-colors">
              Rent Space
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
