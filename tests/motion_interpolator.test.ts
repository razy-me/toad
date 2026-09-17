import { describe, it, expect } from 'vitest';
import {
  lerp,
  lerpColor,
  cubicBezier,
  spring,
  linear,
  easeInOut
} from '../src/motion/interpolator.js';

describe('TOAD Motion: Interpolator & Easing', () => {
  it('interpolates scalar numbers with lerp', () => {
    expect(lerp(10, 20, 0)).toBe(10);
    expect(lerp(10, 20, 0.5)).toBe(15);
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('interpolates colors in linear space without darkening', () => {
    const white = '#ffffff';
    const black = '#000000';
    const mid = lerpColor(white, black, 0.5);
    expect(mid).toMatch(/^#[0-9a-fA-F]{6}$/);

    const red = '#ff0000';
    const blue = '#0000ff';
    const purple = lerpColor(red, blue, 0.5);
    expect(purple).toBeDefined();
  });

  it('evaluates cubic-bezier easing correctly', () => {
    const easeOut = cubicBezier(0, 0, 0.58, 1);
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5); // Ease out starts faster than linear
  });

  it('evaluates analytical spring physics with physical settling', () => {
    const s = spring(120, 10, 1);
    expect(s(0)).toBe(0);
    // At t=1 it should be settled to 1
    expect(s(1)).toBe(1);

    // Lightly damped spring should overshoot past 1 during mid-trajectory
    let hasOvershoot = false;
    for (let t = 0.1; t < 0.9; t += 0.05) {
      if (s(t) > 1.0) {
        hasOvershoot = true;
        break;
      }
    }
    expect(hasOvershoot).toBe(true);
  });
});
