'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks VPark's actual theme: the `dark` class on <html>, which the inline script in
 * layout.tsx and ThemeToggle manage. One MutationObserver per hook instance, removed
 * on unmount. Returns `false` during server render and the first client render.
 */
export function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const read = () => setIsDark(root.classList.contains('dark'));
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
