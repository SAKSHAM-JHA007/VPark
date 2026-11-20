'use client';

import React, { useState } from 'react';
import { User } from '@/types';
import { ModalBackdrop, ModalPanel } from '@/components/motion/AnimatedModal';
import { VParkLogo } from '@/components/VParkLogo';
import { X, Car, Building2 } from 'lucide-react';

interface AuthPanelProps {
  initialIntent?: 'driver' | 'provider';
  onAuthenticated: (user: User) => void;
  onClose?: () => void;
  embedded?: boolean;
}

export function AuthPanel({
  initialIntent = 'driver',
  onAuthenticated,
  onClose,
  embedded = false,
}: AuthPanelProps) {
  const [intent, setIntent] = useState<'driver' | 'provider'>(initialIntent);

  return (
    <div
      className={`w-full max-w-md bg-[var(--surface-bg)] rounded-sm border border-[var(--hairline-strong)] overflow-hidden ${
        embedded ? 'mx-auto' : 'shadow-md'
      }`}
    >
      {/* Masthead */}
      <div className="bg-[var(--surface-alt)] border-b border-[var(--hairline)] px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <VParkLogo variant="stacked" className="h-8 w-auto" />
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-secondary)] block">
              System Access Terminal
            </span>
            <h2 className="text-sm font-bold tracking-tight uppercase text-[var(--ink)] mt-0.5">
              Sign In to VPark
            </h2>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login modal"
            className="p-1 rounded-sm text-[var(--ink-tertiary)] hover:text-[var(--ink)] hover:bg-[var(--surface-bg)] transition-colors border border-transparent hover:border-[var(--hairline)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4 text-xs font-mono">
        {/* Operating Mode Selector */}
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--ink-secondary)] block mb-1.5">
            Select Operating Mode:
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIntent('driver')}
              className={`p-2.5 rounded-sm border text-left transition-colors flex items-center gap-2.5 text-xs ${
                intent === 'driver'
                  ? 'border-[var(--transit-accent)] bg-[var(--surface-bg)] text-[var(--transit-accent)] font-semibold'
                  : 'border-[var(--hairline)] text-[var(--ink-secondary)] hover:bg-[var(--surface-alt)]'
              }`}
            >
              <Car className="w-4 h-4 shrink-0" />
              <div>
                <span className="block text-xs uppercase">Drive / Park</span>
                <span className="text-[10px] text-[var(--ink-tertiary)] font-normal">Reserve bay</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIntent('provider')}
              className={`p-2.5 rounded-sm border text-left transition-colors flex items-center gap-2.5 text-xs ${
                intent === 'provider'
                  ? 'border-[var(--transit-accent)] bg-[var(--surface-bg)] text-[var(--transit-accent)] font-semibold'
                  : 'border-[var(--hairline)] text-[var(--ink-secondary)] hover:bg-[var(--surface-alt)]'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <div>
                <span className="block text-xs uppercase">Host / List</span>
                <span className="text-[10px] text-[var(--ink-tertiary)] font-normal">Rent driveway</span>
              </div>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CLEAN AUTH SCRATCHPAD: Build your new auth flow below     */}
        {/* ======================================================== */}
        <div className="p-4 rounded-sm border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-alt)] text-center space-y-2">
          <p className="text-xs font-semibold text-[var(--ink)]">
            Clean Authentication Scratchpad
          </p>
          <p className="text-[11px] text-[var(--ink-secondary)]">
            Ready to implement your custom auth method from scratch (email/password, OTP, magic link, etc.).
          </p>
        </div>
      </div>
    </div>
  );
}

interface AuthModalProps {
  initialIntent?: 'driver' | 'provider';
  onAuthenticated: (user: User) => void;
  onClose: () => void;
}

export function AuthModal({ initialIntent = 'driver', onAuthenticated, onClose }: AuthModalProps) {
  return (
    <ModalBackdrop
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to VPark"
    >
      <ModalPanel className="w-full max-w-md">
        <AuthPanel initialIntent={initialIntent} onAuthenticated={onAuthenticated} onClose={onClose} />
      </ModalPanel>
    </ModalBackdrop>
  );
}
