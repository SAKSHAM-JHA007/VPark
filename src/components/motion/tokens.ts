import type { CSSProperties } from 'react';

/**
 * Inline style for a staggered CSS entrance. Caps the delay so long lists
 * never make the user wait for content.
 */
export function staggerStyle(index: number, stepMs = 45, maxSteps = 8): CSSProperties {
  return { animationDelay: `${Math.min(index, maxSteps) * stepMs}ms` };
}
