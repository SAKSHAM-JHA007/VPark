'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  // Only animate the icon swap after a user toggle, not on every page load.
  const [hasToggled, setHasToggled] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const isCurrentlyDark = document.documentElement.classList.contains('dark');
    setIsDark(isCurrentlyDark);

    const handleThemeChange = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    window.addEventListener('vpark-theme-change', handleThemeChange);
    return () => window.removeEventListener('vpark-theme-change', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    setHasToggled(true);

    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('vpark_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('vpark_theme', 'light');
    }

    window.dispatchEvent(new Event('vpark-theme-change'));
  };

  // Avoid layout shift during hydration
  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-full border border-[var(--hairline)] ${className}`} />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`w-8 h-8 flex items-center justify-center rounded-full border border-[var(--hairline)] hover:border-[var(--hairline-strong)] bg-[var(--surface-bg)] text-[var(--ink)] hover:bg-[var(--surface-alt)] transition-[background-color,border-color,transform] duration-150 active:scale-90 overflow-hidden ${className}`}
    >
      {isDark ? (
        <Sun key="sun" className={`w-3.5 h-3.5 text-amber-500${hasToggled ? ' animate-spin-in' : ''}`} />
      ) : (
        <Moon key="moon" className={`w-3.5 h-3.5 text-[var(--ink)]${hasToggled ? ' animate-spin-in' : ''}`} />
      )}
    </button>
  );
}

