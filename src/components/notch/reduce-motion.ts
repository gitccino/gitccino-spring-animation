/**
 * Accessibility: respects the user's motion preference.
 *
 * How it works:
 * - `window.matchMedia("(prefers-reduced-motion: reduce)")` returns a live query
 * - We listen for changes (user can toggle this in OS settings at any time)
 * - When prefersReducedMotion is true, the TextMorph engine skips all animation
 *   and just sets text directly — no FLIP, no springs, no fades
 *
 * The `destroy()` method removes the event listener to prevent memory leaks
 * when the component unmounts.
 */
export type ReducedMotionState = {
  readonly prefersReducedMotion: boolean;
  destroy: () => void;
};

export function createReducedMotionListener(): ReducedMotionState {
  // SSR guard — no window on the server
  if (typeof window === "undefined") {
    return { prefersReducedMotion: false, destroy: () => {} };
  }

  const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  // We use a mutable object so consumers always read the latest value
  // without needing a callback/subscription pattern
  const state: { prefersReducedMotion: boolean; destroy: () => void } = {
    prefersReducedMotion: mediaQuery.matches,
    destroy,
  };

  function onChange(event: MediaQueryListEvent) {
    state.prefersReducedMotion = event.matches;
  }

  function destroy() {
    mediaQuery.removeEventListener("change", onChange);
  }

  mediaQuery.addEventListener("change", onChange);
  return state;
}
