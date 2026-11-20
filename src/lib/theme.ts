/**
 * VPark appearance modes: exactly two.
 *
 * - `light`: the default light palette.
 * - `oled`:  a pure-black (#000000) palette for OLED screens. It sets BOTH `.dark`
 *            and `.oled` on <html>, so every existing Tailwind `dark:` style keeps
 *            working; the `.dark` tokens in globals.css are the black OLED values.
 *
 * The preference is stored in localStorage under `vpark_theme` ("light" | "oled").
 * Older builds stored "dark" (a navy palette that no longer exists): it is migrated to
 * "oled" and rewritten, so nobody is left on the retired scheme. With no stored
 * preference the OS colour scheme picks light or OLED.
 *
 * Pure functions only (no React), so the logic is unit-tested in Node and the same
 * rules drive the pre-paint script in `layout.tsx`.
 */

export const THEME_STORAGE_KEY = 'vpark_theme';
export const THEME_CHANGE_EVENT = 'vpark-theme-change';
export const THEMES = ['light', 'oled'] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'oled';
}

/** Maps any stored value (including the retired "dark") onto a supported theme, or null. */
export function migrateStoredTheme(value: unknown): Theme | null {
  if (value === 'light') return 'light';
  if (value === 'oled' || value === 'dark') return 'oled';
  return null;
}

/** Stored preference if valid (legacy "dark" → OLED), otherwise the OS preference. */
export function resolveTheme(stored: string | null | undefined, prefersDark: boolean): Theme {
  return migrateStoredTheme(stored) ?? (prefersDark ? 'oled' : 'light');
}

/** The one-click toggle: Light ↔ OLED. */
export function nextTheme(current: Theme): Theme {
  return current === 'oled' ? 'light' : 'oled';
}

interface ClassListLike {
  toggle(token: string, force?: boolean): boolean;
}

interface RootLike {
  classList: ClassListLike;
  setAttribute(name: string, value: string): void;
}

/** Apply a theme to the document root: `.dark` + `.oled` for OLED, neither for Light. */
export function applyThemeToRoot(root: RootLike, theme: Theme): void {
  const dark = theme === 'oled';
  root.classList.toggle('dark', dark);
  root.classList.toggle('oled', dark);
  root.setAttribute('data-theme', theme);
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readStoredTheme(storage: StorageLike | null | undefined): Theme | null {
  try {
    return migrateStoredTheme(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function persistTheme(storage: StorageLike | null | undefined, theme: Theme): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private mode, quota): the theme still applies for this page.
  }
}

/** Reads the theme currently applied to the document root (`data-theme`, then classes). */
export function readAppliedTheme(root: { getAttribute(name: string): string | null; classList: { contains(t: string): boolean } }): Theme {
  const attr = migrateStoredTheme(root.getAttribute('data-theme'));
  if (attr) return attr;
  return root.classList.contains('dark') || root.classList.contains('oled') ? 'oled' : 'light';
}

/**
 * Inline script for <head>: applies the stored theme before first paint so there is
 * no light flash for OLED users, and rewrites a legacy "dark" value to "oled". Kept in
 * sync with `resolveTheme` and `applyThemeToRoot` by a unit test that executes this
 * exact string.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement;var s=null;var t=null;try{s=window.localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}if(s==='light'){t='light'}else if(s==='oled'||s==='dark'){t='oled';if(s==='dark'){try{window.localStorage.setItem('${THEME_STORAGE_KEY}','oled')}catch(e){}}}else{t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'oled':'light'}var o=t==='oled';d.classList.toggle('dark',o);d.classList.toggle('oled',o);d.setAttribute('data-theme',t)}catch(e){}})();`;

// ---------------------------------------------------------------------------
// Theme reveal geometry (used by the one-click toggle's circular transition)
// ---------------------------------------------------------------------------

export interface RevealGeometry {
  x: number;
  y: number;
  /** Radius that covers the farthest viewport corner from (x, y). */
  radius: number;
}

/**
 * Origin of the circular theme reveal in viewport (client) coordinates. Pointer
 * activations use the pointer position; keyboard activations (no pointer, or a
 * 0,0 synthetic click) use the centre of the button. Values are clamped to the
 * viewport so a scrolled or partially off-screen button still reveals sensibly.
 */
export function revealGeometry(
  rect: { left: number; top: number; width: number; height: number },
  viewport: { width: number; height: number },
  pointer?: { x: number; y: number } | null
): RevealGeometry {
  const usePointer = pointer && (pointer.x !== 0 || pointer.y !== 0);
  const rawX = usePointer ? pointer.x : rect.left + rect.width / 2;
  const rawY = usePointer ? pointer.y : rect.top + rect.height / 2;
  const x = Math.min(Math.max(rawX, 0), viewport.width);
  const y = Math.min(Math.max(rawY, 0), viewport.height);
  const radius = Math.ceil(Math.hypot(Math.max(x, viewport.width - x), Math.max(y, viewport.height - y)));
  return { x, y, radius };
}

export type ThemeTransitionMode = 'reveal' | 'fade' | 'instant';

/** Circular reveal needs the View Transition API; reduced motion gets no movement at all. */
export function chooseTransitionMode(env: { hasViewTransitions: boolean; reducedMotion: boolean }): ThemeTransitionMode {
  if (env.reducedMotion) return 'instant';
  return env.hasViewTransitions ? 'reveal' : 'fade';
}
