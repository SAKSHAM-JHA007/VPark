import React from 'react';
import Link from 'next/link';
import { VParkLogo } from '@/components/VParkLogo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Compass, Home, Search, HelpCircle, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Page Not Found (404) | VPark Bengaluru',
  description: 'The parking bay or page you are looking for does not exist or has been relocated.',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#07090E] text-slate-900 dark:text-slate-100 flex flex-col justify-between font-sans transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B0C10] border-b border-neutral-800 text-white select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 focus-visible:outline-none">
            <VParkLogo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Back Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main 404 Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16 sm:py-24 flex flex-col items-center justify-center text-center space-y-8">
        <div className="relative">
          <div className="animate-scale-in w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-blue-50 dark:bg-blue-950/40 text-[#0A5CFF] flex items-center justify-center border border-blue-200 dark:border-blue-900/60 shadow-inner">
            <Compass className="w-12 h-12 sm:w-14 sm:h-14 animate-spin-slow" />
          </div>
          <span className="animate-pop [animation-delay:350ms] absolute -top-2 -right-2 px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[11px] font-bold shadow-md">
            404
          </span>
        </div>

        <div className="space-y-3 max-w-md animate-fade-up [animation-delay:120ms]">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Parking Bay Not Found
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            The page, reservation, or parking space you are looking for has been relocated or is no longer listed.
          </p>
        </div>

        {/* Action Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-md pt-2">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#0A5CFF] hover:bg-[#0047d4] text-white font-bold text-sm shadow-md transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Return to Homepage</span>
          </Link>
          <Link
            href="/driver/home"
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-neutral-900 hover:bg-slate-50 dark:hover:bg-neutral-800 text-slate-800 dark:text-slate-200 font-bold text-sm border border-slate-200 dark:border-neutral-800 shadow-sm transition-colors"
          >
            <Search className="w-4 h-4 text-[#0A5CFF]" />
            <span>Find Parking Bays</span>
          </Link>
        </div>

        {/* Quick Links */}
        <div className="pt-6 border-t border-slate-200 dark:border-neutral-800 w-full max-w-md flex items-center justify-around text-xs text-slate-500 dark:text-slate-400">
          <Link href="/owner/dashboard" className="hover:text-[#0A5CFF] transition-colors">
            Rent Your Space
          </Link>
          <span>·</span>
          <Link href="/contact" className="hover:text-[#0A5CFF] transition-colors flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Contact Support</span>
          </Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-[#0A5CFF] transition-colors">
            Privacy Policy
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 py-4 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>© {new Date().getFullYear()} VPark · Smart Parking Platform Bengaluru</p>
      </footer>
    </div>
  );
}
