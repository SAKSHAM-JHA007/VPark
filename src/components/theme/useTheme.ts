'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  applyThemeToRoot,
  persistTheme,
  readAppliedTheme,
  resolveTheme,
  type Theme,
} from '@/lib/theme';

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Current appearance mode and a setter. The pre-paint script in layout.tsx has already
 * applied the stored theme, so this hook only mirrors what is on <html>. Returns
 * `mounted: false` (and `light`) during SSR and the first client render.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setThemeState(readAppliedTheme(root));
    sync();
    setMounted(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
      applyThemeToRoot(root, resolveTheme(e.newValue, prefersDark));
      sync();
    };
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyThemeToRoot(document.documentElement, next);
    persistTheme(safeStorage(), next);
    setThemeState(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  return { theme, setTheme, mounted };
}
