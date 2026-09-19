/**
 * src/motion/interpolator.ts
 * Animation math, easing curves, spring physics, and color interpolation for TOAD Motion.
 */

import { EasingDefinition } from './ast.js';
import { parseColorToRgba } from '../engine/drawUtils.js';

export type Easer = (t: number) => number;

/**
 * Standard linear easing
 */
export const linear: Easer = (t: number) => t;

/**
 * CSS standard easings
 */
export const easeIn: Easer = (t: number) => t * t;
export const easeOut: Easer = (t: number) => t * (2 - t);
export const easeInOut: Easer = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
export const ease: Easer = cubicBezier(0.25, 0.1, 0.25, 1.0);

/**
 * High-precision Cubic Bézier curve implementation (CSS cubic-bezier).
 * Solves x(t) = target via Newton-Raphson with bisection fallback, then evaluates y(t).
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easer {
  // If linear
  if (x1 === y1 && x2 === y2) return (t: number) => t;

  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  function sampleCurveX(t: number) {
    return ((ax * t + bx) * t + cx) * t;
  }

  function sampleCurveY(t: number) {
    return ((ay * t + by) * t + cy) * t;
  }

  function sampleCurveDerivativeX(t: number) {
    return (3 * ax * t + 2 * bx) * t + cx;
  }

  function solveCurveX(x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    // Newton-Raphson iteration
    let t = x;
    for (let i = 0; i < 8; i++) {
      const currentX = sampleCurveX(t) - x;
      if (Math.abs(currentX) < 1e-6) return t;
      const dX = sampleCurveDerivativeX(t);
      if (Math.abs(dX) < 1e-6) break;
      t -= currentX / dX;
    }

    // Fallback: Bisection
    let t0 = 0;
    let t1 = 1;
    t = x;

    while (t0 < t1) {
      const currentX = sampleCurveX(t);
      if (Math.abs(currentX - x) < 1e-6) return t;
      if (x > currentX) {
        t0 = t;
      } else {
        t1 = t;
      }
      t = (t1 + t0) / 2;
    }

    return t;
  }

  return (x: number) => sampleCurveY(solveCurveX(x));
}

/**
 * Analytical Spring physics (damped harmonic oscillator).
 * Produces authentic physical overshoot and settling without numeric integration.
 */
export function spring(stiffness = 100, damping = 10, mass = 1): Easer {
  const m = Math.max(0.01, mass);
  const k = Math.max(0.01, stiffness);
  const c = Math.max(0, damping);

  const w0 = Math.sqrt(k / m); // undamped angular frequency
  const zeta = c / (2 * Math.sqrt(k * m)); // damping ratio

  const blendSettle = (raw: number, t: number): number => {
    if (t <= 0.95) return raw;
    if (t >= 1) return 1;
    const alpha = (t - 0.95) / 0.05;
    const s = alpha * alpha * (3 - 2 * alpha);
    return raw * (1 - s) + s;
  };

  if (zeta < 1) {
    // Underdamped (oscillates and overshoots)
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return (t: number) => {
      const decay = Math.exp(-zeta * w0 * t * 5); // scale t to feel natural over [0, 1]
      const envelope = Math.cos(wd * t * 5) + ((zeta * w0) / wd) * Math.sin(wd * t * 5);
      return blendSettle(1 - decay * envelope, t);
    };
  } else if (Math.abs(zeta - 1) < 1e-4) {
    // Critically damped (fastest return without oscillation)
    return (t: number) => {
      const decay = Math.exp(-w0 * t * 5);
      return blendSettle(1 - decay * (1 + w0 * t * 5), t);
    };
  } else {
    // Overdamped
    const s = w0 * Math.sqrt(zeta * zeta - 1);
    return (t: number) => {
      const gamma1 = -zeta * w0 + s;
      const gamma2 = -zeta * w0 - s;
      const c1 = gamma2 / (gamma2 - gamma1);
      const c2 = -gamma1 / (gamma2 - gamma1);
      return blendSettle(1 - (c1 * Math.exp(gamma1 * t * 5) + c2 * Math.exp(gamma2 * t * 5)), t);
    };
  }
}

/**
 * Resolves an AST EasingDefinition to an Easer function.
 */
export function resolveEasing(def?: EasingDefinition): Easer {
  if (!def) return easeInOut;

  switch (def.type) {
    case 'linear':
      return linear;
    case 'ease':
      return ease;
    case 'ease-in':
      return easeIn;
    case 'ease-out':
      return easeOut;
    case 'ease-in-out':
      return easeInOut;
    case 'cubic-bezier': {
      const args = def.bezierArgs ?? [0.25, 0.1, 0.25, 1.0];
      return cubicBezier(args[0], args[1], args[2], args[3]);
    }
    case 'spring': {
      const { stiffness = 100, damping = 10, mass = 1 } = def.springArgs ?? {};
      return spring(stiffness, damping, mass);
    }
    default:
      return easeInOut;
  }
}

/**
 * Standard scalar linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Converts sRGB [0..255] to linear RGB [0..1]
 */
function sRgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Converts linear RGB [0..1] to sRGB [0..255]
 */
function linearToSRgb(v: number): number {
  const clamped = Math.max(0, Math.min(1, v));
  const c = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, c * 255)));
}

/**
 * Interpolates two color strings (Hex, RGB, RGBA, Named) smoothly in linear sRGB space.
 */
export function lerpColor(c1: string, c2: string, t: number): string {
  const r1 = parseColorToRgba(c1);
  const r2 = parseColorToRgba(c2);

  // Linearize color channels for natural luminance preservation
  const linR1 = sRgbToLinear(r1.r);
  const linG1 = sRgbToLinear(r1.g);
  const linB1 = sRgbToLinear(r1.b);

  const linR2 = sRgbToLinear(r2.r);
  const linG2 = sRgbToLinear(r2.g);
  const linB2 = sRgbToLinear(r2.b);

  const outR = linearToSRgb(lerp(linR1, linR2, t));
  const outG = linearToSRgb(lerp(linG1, linG2, t));
  const outB = linearToSRgb(lerp(linB1, linB2, t));
  const outA = Math.max(0, Math.min(1, lerp(r1.a, r2.a, t)));

  if (outA >= 0.999) {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(outR)}${toHex(outG)}${toHex(outB)}`;
  }

  return `rgba(${outR}, ${outG}, ${outB}, ${outA.toFixed(3)})`;
}
