import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ContactForm } from '@/components/ContactForm';
import { Mail, Phone, MapPin, Clock, ArrowLeft, ShieldCheck, HelpCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Support | VPark',
  description: 'Get in touch with the VPark team for assistance.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#07090E] text-slate-900 dark:text-slate-100 flex flex-col justify-between font-sans transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B0C10] border-b border-neutral-800 text-white select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 focus-visible:outline-none">
              <VParkLogo className="h-8 w-auto" />
            </Link>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-neutral-700 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Breadcrumb Navigation UI */}
        <nav aria-label="Breadcrumb" className="text-xs text-slate-500 dark:text-slate-400">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="font-semibold text-slate-900 dark:text-white" aria-current="page">
              Contact Us
            </li>
          </ol>
        </nav>

        {/* Page Title & Intro */}
        <div className="space-y-2 border-b border-slate-200 dark:border-neutral-800 pb-6">
          <span className="text-[11px] font-bold tracking-widest uppercase text-[#0A5CFF] block">
            Direct Support &amp; Host Assistance
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Contact VPark Support &amp; Team
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            Have questions about booking a parking bay, listing your private or commercial space, or need assistance
            during an active reservation? Our Bengaluru team is here to help.
          </p>
        </div>

        {/* Two-Column Grid: Contact Details & Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Direct Contact Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 shadow-xs space-y-6">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Direct Assistance Channels
              </h2>

              <div className="space-y-4 text-xs">
                {/* Email */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 text-[#0A5CFF] flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Email Inquiries</span>
                    <a
                      href="mailto:support@vpark.in"
                      className="text-[#0A5CFF] hover:underline transition-colors mt-0.5 inline-block font-mono"
                    >
                      support@vpark.in
                    </a>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Response within 24 hours</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 text-[#0A5CFF] flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Customer Support Line</span>
                    <a
                      href="tel:+918045682026"
                      className="text-[#0A5CFF] hover:underline transition-colors mt-0.5 inline-block font-mono"
                    >
                      +91 80 4568 2026
                    </a>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Mon–Sat, 08:00 – 20:00 IST</p>
                  </div>
                </div>

                {/* Office Location */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 text-[#0A5CFF] flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Registered Operations</span>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed mt-0.5">
                      Sector 01, Yelahanka New Town, Bengaluru, Karnataka 560064, India
                    </p>
                  </div>
                </div>

                {/* Operating Hours */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-900/60 text-[#0A5CFF] flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block font-bold text-slate-900 dark:text-white">Platform Availability</span>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed mt-0.5">
                      Digital booking engine operates 24/7. Physical bays accessible per host terms.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Link Card for Hosts */}
            <div className="bg-gradient-to-br from-[#060D1E] via-[#09152F] to-[#0A1A3A] border border-blue-900/40 rounded-3xl p-6 text-white space-y-3">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Space Providers</span>
              </div>
              <h3 className="text-base font-extrabold text-white">Want to list your parking space?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Earn steady monthly income from unused driveway, basement, or commercial bays with automated gate access and verified payments.
              </p>
              <div className="pt-1">
                <Link
                  href="/login?intent=provider"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-slate-950 font-bold text-xs hover:bg-slate-100 transition-colors shadow-sm"
                >
                  <span>Start Hosting</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Working Contact Form */}
          <div className="lg:col-span-7 bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800 p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Send Us a Message</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Fill out the form below. All inquiries are securely logged and routed to our support specialists.
              </p>
            </div>

            <ContactForm />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0B0C10] py-6 px-4 sm:px-6 lg:px-8 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <VParkLogo className="h-6 w-auto" />
            <span>·</span>
            <span>Bengaluru Smart Parking &amp; Verified Bays</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] flex-wrap justify-center">
            <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <span>·</span>
            <Link href="/driver/home" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Find Parking
            </Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/contact" className="hover:text-slate-900 dark:hover:text-white transition-colors font-semibold text-[#0A5CFF]">
              Contact Us
            </Link>
            <span>·</span>
            <span>© {new Date().getFullYear()} VPark</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
