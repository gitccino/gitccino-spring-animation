import { spring } from "../../lib/spring-physics/spring";
import type { SpringParams } from "../../lib/spring-physics/types";
import { createReducedMotionListener } from "./reduce-motion";

export type NotchState = "pill" | "expanded";

/**
 * A single radius value for all corners, or individual corners.
 * corner order: top-left, top-right, bottom-right, bottom-left.
 */
export type CornerRadius =
  | number
  | { tl?: number; tr?: number; br?: number; bl?: number };

/**
 * Converts a CornerRadius to a CSS border-radius string.
 */
function toRadiusCSS(r: CornerRadius): string {
  if (typeof r === "number") return `${r}px`;
  const { tl = 0, tr = 0, br = 0, bl = 0 } = r;
  return `${tl}px ${tr}px ${br}px ${bl}px`;
}

export interface NotchEngineOptions {
  ease?: SpringParams | string;
  speed?: number;
  duration?: number;
  contentDelay?: number;
  borderRadius?: {
    pill?: CornerRadius;
    expanded?: CornerRadius;
  };
  respectReducedMotion?: boolean;
  onMorphStart?: (state: NotchState) => void;
  onMotphEnd?: (state: NotchState) => void;
}

export interface InternalRefs {
  container: HTMLElement;
  pillEl: HTMLElement;
  expandedEl: HTMLElement;
}

interface ShapeTarget {
  width: number;
  height: number;
  borderRadius: string; // CSS string, e.g. "20px" or "0px 0px 20px 20px"
}

const DEFAULT_EASE: SpringParams = { stiffness: 300, damping: 36, mass: 1 };
const DEFAULT_RADIUS: { pill: CornerRadius; expanded: CornerRadius } = {
  pill: 20,
  expanded: 26,
};
const DEFAULT_SPEED = 1;

export class NotchEngine {
  private container: HTMLElement;
  private pillEl: HTMLElement;
  private expandedEl: HTMLElement;
  private opts: NotchEngineOptions;
  private state: NotchState = "pill";
  private easing = "linear";
  private duration = 400;
  private observer: ResizeObserver;
  private reducedMotion = createReducedMotionListener();
  private destroyed = false;

  constructor(refs: InternalRefs, options: NotchEngineOptions) {
    this.container = refs.container;
    this.pillEl = refs.pillEl;
    this.expandedEl = refs.expandedEl;
    this.opts = options;
    this.recomputedSpring();

    // size container to pill, instantly with no animation
    this.applyInstant(this.measure("pill"));
    this.container.classList.remove("is-expanded");

    // ResizeObserver - single instance, two observation
    this.observer = new ResizeObserver(() => this.handleResize());
    this.observer.observe(this.pillEl);
    this.observer.observe(this.expandedEl);
  }

  setState(state: NotchState) {
    if (this.destroyed || this.state === state) return;
    this.state = state;
    this.opts.onMorphStart?.(state);
    if (state === "expanded") this.container.classList.add("is-expanded");
    else this.container.classList.remove("is-expanded");
    this.applyContentDelay();
    const target = this.measure(state);
    this.morph(target).then(() => {
      if (!this.destroyed && this.state === state)
        this.opts.onMotphEnd?.(state);
    });
  }

  setOptions(partial: Partial<NotchEngineOptions>) {
    this.opts = { ...this.opts, ...partial };
    this.recomputedSpring();
    this.applyContentDelay();
  }

  destroy() {
    this.destroyed = true;
    this.observer.disconnect();
    this.reducedMotion.destroy();
    this.container.getAnimations().forEach((a) => a.cancel());
  }

  // ─── Internal ───
  private recomputedSpring() {
    const ease = this.opts.ease ?? DEFAULT_EASE;
    const speed = this.opts.speed ?? DEFAULT_SPEED;
    if (typeof ease === "string") {
      this.easing = ease;
    } else {
      const r = spring(ease);
      this.easing = r.easing;
      this.duration = (this.opts.duration ?? r.duration) / speed;
    }
  }

  private applyContentDelay() {
    const delay = this.opts.contentDelay ?? 80;
    // CSS handles the actual transition; we just set the delay so the content
    // fade lines up with the morph beat.
    this.pillEl.style.transitionDelay =
      this.state === "expanded" ? "0ms" : `${delay}ms`;
    this.expandedEl.style.transitionDelay =
      this.state === "expanded" ? `${delay}ms` : "0ms";
  }

  private measure(state: NotchState): ShapeTarget {
    // **Start from here**
    const el = state === "pill" ? this.pillEl : this.expandedEl;
    const rect = el.getBoundingClientRect();
    const radius =
      state === "pill"
        ? (this.opts.borderRadius?.pill ?? DEFAULT_RADIUS.pill)
        : (this.opts.borderRadius?.expanded ?? DEFAULT_RADIUS.expanded);
    return {
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      borderRadius: toRadiusCSS(radius),
    };
  }

  private handleResize() {
    if (this.destroyed) return;

    // Re-measure the current active element and morph if changed
    const target = this.measure(this.state);
    const cs = getComputedStyle(this.container);
    const curW = parseFloat(cs.width);
    const curH = parseFloat(cs.height);
    if (
      Math.abs(curW - target.width) < 0.5 &&
      Math.abs(curH - target.height) < 0.5
    )
      return;
    this.morph(target);
  }

  private applyInstant(target: ShapeTarget) {
    this.container.style.width = `${target.width}px`;
    this.container.style.height = `${target.height}px`;
    this.container.style.borderRadius = target.borderRadius;
  }

  private async morph(target: ShapeTarget): Promise<void | Animation> {
    // respectReducedMotion is default to TRUE
    if (
      this.opts.respectReducedMotion !== false &&
      this.reducedMotion.prefersReducedMotion
    ) {
      this.container.getAnimations().forEach((a) => a.cancel());
      this.applyInstant(target);
      return Promise.resolve();
    }

    // Read live computed values before cancelling - once we calcel, WAAPI
    // releases its `fill: 'both'` hold and the element snaps back to its
    // inline base style. Reading after cancel would lose interruption support.
    const cs = getComputedStyle(this.container);
    const from = {
      width: cs.width,
      height: cs.height,
      borderRadius: cs.borderRadius,
    };
    this.container.getAnimations().forEach((a) => a.cancel());

    // Persist final values as inline style so WAAPI fill keeps them visually
    // and so future getComputedStyle reads are stable after fill is released
    // *
    // So that after fill is released, the element wouldn't revert to whatever
    // base styles was, causing a visual snap
    this.applyInstant(target);

    const anim = this.container.animate(
      [
        from,
        {
          width: `${target.width}px`,
          height: `${target.height}px`,
          borderRadius: `${target.borderRadius}`, // remove px
        },
      ],
      {
        duration: this.duration,
        easing: this.easing,
        fill: "both",
      },
    );

    // `.catch(() => {}` swallows the rejection silently. Without it, interrupting
    // an in-flight animation would produce an unhandled promise rejection
    return anim.finished.catch(() => {});
  }
}
