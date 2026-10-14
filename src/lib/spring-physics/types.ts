/**
 * Spring physics parameters for generating natural easing curves
 *
 * These map directly to a damped harmonic oscillator
 * - stiffness (k): how "tight" the spring is (higher = faster snap)
 * - damping (c): how much friction (higher = less bounce)
 * - mass (m)
 * - precision: how close to 1.0 the spring must settle before consider it "done"
 * - alpha: samples clustering | 0.5 - half the samples cover the first ~30% | 1 - uniform sampling
 */
export interface SpringParams {
  stiffness?: number;
  damping?: number;
  mass?: number;
  precision?: number;
  alpha?: number;
}

export interface SpringResult {
  easing: string; // CSS linear() function to string
  duration: number; // computed settling time in ms
}
