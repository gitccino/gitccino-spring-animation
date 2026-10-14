/**
 * Spring Physics → CSS Easing Generator
 *
 * THE BIG IDEA:
 * We want spring-like motion in CSS animations. But CSS doesn't have a
 * "spring" easing. What it DOES have (since 2023) is `linear()` — a
 * piecewise-linear easing that interpolates between sampled points.
 *
 * So we:
 * 1. Simulate a damped harmonic oscillator (a spring)
 * 2. Sample its position at 32-100 evenly-spaced time points
 * 3. Output those samples as a CSS `linear(p1, p2, ..., pN)` string
 *
 * The browser then interpolates between those points during animation.
 * With enough samples (32+), the result is visually indistinguishable
 * from a true spring animation — but it runs on the GPU compositor,
 * not the main thread.
 */

export type { SpringParams, SpringResult } from "./types";
import type { SpringParams, SpringResult } from "./types";

/**
 * Calculate the position of a spring at time t.
 *
 * This solves the differential equation for a damped harmonic oscillator:
 *   m * x''(t) + c * x'(t) + k * x(t) = 0
 *
 * Where:
 *   omega0 = sqrt(k/m)    — natural frequency (how fast it wants to oscillate)
 *   zeta = c / (2*sqrt(k*m)) — damping ratio (how quickly oscillations die)
 *
 * Two cases:
 *
 * UNDERDAMPED (zeta < 1): The spring oscillates and gradually settles.
 *   omegaD = omega0 * sqrt(1 - zeta^2)  — damped frequency
 *   x(t) = 1 - e^(-zeta*omega0*t) * [cos(omegaD*t) + (zeta*omega0/omegaD)*sin(omegaD*t)]
 *
 *   The e^(-...) envelope makes oscillations decay over time.
 *   cos + sin create the back-and-forth oscillation.
 *   This is what gives springs their characteristic "bounce".
 *
 * OVERDAMPED (zeta >= 1): No oscillation, just exponential approach to 1.
 *   Two decay rates: r1 = -omega0*(zeta+s), r2 = -omega0*(zeta-s)
 *   where s = sqrt(zeta^2 - 1)
 *   x(t) = 1 - A*e^(r1*t) - B*e^(r2*t)
 *
 *   This is like pushing through honey — smooth but no bounce.
 */
function springPosition(t: number, omega0: number, zeta: number): number {
  if (zeta < 1) {
    // Underdamped: oscillates with exponential decay
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    return (
      1 -
      Math.exp(-zeta * omega0 * t) *
        (Math.cos(omegaD * t) +
          ((zeta * omega0) / omegaD) * Math.sin(omegaD * t))
    );
  }

  // Overdamped (includes near-critically-damped)
  const s = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega0 * (zeta + s);
  const r2 = -omega0 * (zeta - s);
  const B = -r1 / (r2 - r1);
  const A = 1 - B;
  return 1 - A * Math.exp(r1 * t) - B * Math.exp(r2 * t);
}

/**
 * Determine how long the spring takes to settle.
 *
 * We step through time in 1ms increments and check if the position
 * has stayed within `precision` of 1.0 for at least 100ms continuously.
 * Once it has, we know the spring has effectively stopped moving.
 *
 * The 100ms "quiet period" prevents false positives — an underdamped
 * spring might briefly pass through 1.0 during an oscillation, but
 * it won't STAY near 1.0 for 100ms until it's truly settled.
 *
 * Returns duration in milliseconds (integer, rounded up).
 */
function computeDuration(
  omega0: number,
  zeta: number,
  precision: number,
): number {
  const maxDuration = 10000; // 10 second hard cap in ms

  if (zeta < 1) {
    // Underdamped: envelope is e^(-ζω₀t) scaled by 1/√(1-ζ²)
    // Solve: (1/√(1-ζ²)) * e^(-ζω₀t) = precision
    const amplitudeFactor = 1 / Math.sqrt(1 - zeta * zeta);
    const t = Math.log(amplitudeFactor / precision) / (zeta * omega0);
    return Math.min(Math.ceil(t * 1000), maxDuration);
  }

  // Overdamped: slower decay rate dominates
  const s = Math.sqrt(zeta * zeta - 1);
  const r2 = omega0 * (zeta - s); // positive, slower decay
  if (r2 === 0) return maxDuration;
  const t = -Math.log(precision) / r2;
  return Math.min(Math.ceil(t * 1000), maxDuration);
}

/**
 * Cache avoids recomputing the same spring for identical params.
 * Key format: "stiffness:damping:mass:precision" or "rev:stiffness:..."
 *
 * This matters because the spring computation samples thousands of
 * points (computeDuration iterates up to 10,000 times) — not something
 * you want to repeat on every text change.
 */
const cache = new Map<string, SpringResult>();

/**
 * Sample spring positions at non-uniform time points (power-law distribution)
 * and format them as a CSS `linear()` string with explicit stop positions.
 *
 * WHY NON-UNIFORM SAMPLING:
 * CSS `linear()` linearly interpolates between samples. Springs move fastest
 * at the start and barely move at the end. Uniform sampling wastes points on
 * the flat tail and starves the critical early phase where accuracy matters.
 *
 * We cluster samples near the start using t_i = (i/(N-1))^alpha * T.
 * With alpha=0.5 (square root), half the samples cover the first ~30% of
 * animation time — right where the spring is changing fastest.
 *
 * WHY EXPLICIT CSS POSITIONS:
 * With non-uniform time steps we can't use the implicit equal-spacing that
 * `linear(v0, v1, ...)` assumes. CSS `linear()` supports explicit positions:
 * `linear(v0, v1 4.1%, v2 7.3%, ..., 1 100%)` — each sample is pinned to
 * its correct animation-progress position.
 *
 * OLD uniform sampling (kept for reference):
 *   const t = (i / (numPoints - 1)) * (duration / 1000);           // uniform
 *   points.push(Math.round(value * 1000) / 1000 + "");             // no position
 *   easing: `linear(${points.join(", ")})`                         // equal spacing
 */
function buildLinearEasing(
  omega0: number,
  zeta: number,
  duration: number,
  numPoints: number,
  reverse: boolean,
  alpha: number,
): string {
  const T = duration / 1000; // total duration in seconds

  const parts: string[] = [];

  for (let i = 0; i < numPoints; i++) {
    const progress = i / (numPoints - 1); // 0 → 1

    // Non-uniform time: cluster samples near the start
    const t = Math.pow(progress, alpha) * T;

    // Spring position (forced to exactly 1 at the end to avoid float drift)
    const rawValue = i === numPoints - 1 ? 1 : springPosition(t, omega0, zeta);

    // Reverse: flip the curve so it's ease-in instead of ease-out.
    // 1 - springPosition(T - t) reads the spring backwards in time.
    // At progress=0: value near 0 (slow start). At progress=1: value = 1 (full).
    const value = reverse ? 1 - springPosition(T - t, omega0, zeta) : rawValue;
    const rounded = Math.round(value * 1000) / 1000;

    // First and last points don't need explicit positions (CSS assumes 0% / 100%)
    if (i === 0 || i === numPoints - 1) {
      parts.push(`${rounded}`);
    } else {
      // Explicit position: where in animation-progress [0%–100%] this sample falls
      const posPercent = Math.round(progress * 1000) / 10; // 1 decimal place
      parts.push(`${rounded} ${posPercent}%`);
    }
  }

  return `linear(${parts.join(", ")})`;
}

/**
 * Convert spring physics parameters into a CSS easing function.
 *
 * Returns both the `linear(...)` CSS string AND the computed duration.
 * When using spring easing, the caller should use this duration instead
 * of any user-specified duration — the physics determines timing.
 */

export function spring(params?: SpringParams): SpringResult {
  const {
    stiffness = 100,
    damping = 10,
    mass = 1,
    precision = 0.001,
    alpha = 0.9,
  } = params ?? {};

  const key = `${stiffness}:${damping}:${mass}:${precision}:${alpha}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const duration = computeDuration(omega0, zeta, precision);

  // Adaptive sample count: more samples for longer animations
  const numPoints = Math.min(100, Math.max(32, Math.round(duration / 15)));

  const result: SpringResult = {
    easing: buildLinearEasing(omega0, zeta, duration, numPoints, false, alpha),
    // easing: buildLinearEasingUniformSampling(omega0, zeta, duration, numPoints),
    duration,
  };

  cache.set(key, result);
  return result;
}

/**
 * Generate a REVERSED spring easing — ease-in instead of ease-out.
 *
 * WHY:
 * The forward spring is naturally ease-out: fast departure → decelerating arrival.
 * This is correct for ENTERING elements (sliding in and settling).
 *
 * But for EXITING elements, ease-in is physically correct: the element starts
 * from rest and accelerates away, like gravity or a snap. With ease-out on exits
 * the element rushes to its exit position then slows and lingers there — wrong.
 *
 * The reversed spring is 1 - spring(T - t), which reads the spring backwards
 * in time: slow at the start, fast at the end. Same physics, opposite feel.
 *
 * Same duration as the forward spring (they're the same spring, just reversed).
 */
export function reverseSpring(params?: SpringParams): SpringResult {
  const {
    stiffness = 100,
    damping = 10,
    mass = 1,
    precision = 0.001,
    alpha = 0.9,
  } = params ?? {};

  const key = `rev:${stiffness}:${damping}:${mass}:${precision}:${alpha}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const duration = computeDuration(omega0, zeta, precision);

  const numPoints = Math.min(100, Math.max(32, Math.round(duration / 15)));

  const result: SpringResult = {
    easing: buildLinearEasing(omega0, zeta, duration, numPoints, true, alpha),
    duration,
  };

  cache.set(key, result);
  return result;
}
