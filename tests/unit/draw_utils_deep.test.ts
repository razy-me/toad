import { describe, it, expect } from 'vitest';
import {
  parseColorToRgba,
  cmykToRgb,
  lightenColor,
  darkenColor,
  applyAlpha,
  distributeGradientStops,
  mapBlendMode,
  mapBlendModeToPsd,
  parseFilterString
} from '../../src/engine/drawUtils.js';

describe('Unit Tests: Draw Utilities & Color Engine', () => {
  describe('Color Parsing (parseColorToRgba)', () => {
    it('parses 3-digit, 4-digit, 6-digit, and 8-digit hex colors', () => {
      expect(parseColorToRgba('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColorToRgba('#0000')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
      expect(parseColorToRgba('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
      expect(parseColorToRgba('#38bdf880')).toEqual({ r: 56, g: 189, b: 248, a: 0.5019607843137255 });
    });

    it('parses rgb() and rgba() function formats', () => {
      expect(parseColorToRgba('rgb(255, 128, 0)')).toEqual({ r: 255, g: 128, b: 0, a: 1 });
      expect(parseColorToRgba('rgba(100, 150, 200, 0.5)')).toEqual({ r: 100, g: 150, b: 200, a: 0.5 });
      expect(parseColorToRgba('rgb(100% 50% 0%)')).toEqual({ r: 255, g: 127.5, b: 0, a: 1 });
    });

    it('parses hsl() and hsla() formats with degrees and percentages', () => {
      // HSL 0deg, 100%, 50% = Red rgb(255, 0, 0)
      const red = parseColorToRgba('hsl(0, 100%, 50%)');
      expect(red).toEqual({ r: 255, g: 0, b: 0, a: 1 });

      // HSL 120deg, 100%, 50% = Green rgb(0, 255, 0)
      const green = parseColorToRgba('hsl(120deg, 100%, 50%)');
      expect(green).toEqual({ r: 0, g: 255, b: 0, a: 1 });

      // HSL 240deg, 100%, 50% with alpha
      const blue = parseColorToRgba('hsla(240, 100%, 50%, 0.75)');
      expect(blue).toEqual({ r: 0, g: 0, b: 255, a: 0.75 });
    });

    it('parses cmyk() function format to sRGB accurately', () => {
      expect(cmykToRgb(1, 0, 0, 0)).toEqual({ r: 0, g: 255, b: 255, a: 1 }); // 100% Cyan
      expect(cmykToRgb(0, 1, 0, 0)).toEqual({ r: 255, g: 0, b: 255, a: 1 }); // 100% Magenta
      expect(cmykToRgb(0, 0, 1, 0)).toEqual({ r: 255, g: 255, b: 0, a: 1 }); // 100% Yellow
      expect(cmykToRgb(0, 0, 0, 1)).toEqual({ r: 0, g: 0, b: 0, a: 1 }); // 100% Black
    });

    it('parses standard named CSS colors and transparent', () => {
      expect(parseColorToRgba('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
      expect(parseColorToRgba('black')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseColorToRgba('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
      expect(parseColorToRgba('red')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });
  });

  describe('Color Manipulation Functions', () => {
    it('applies alpha transparency to hex and rgb colors', () => {
      const transparentHex = applyAlpha('#ff0000', 0.5);
      expect(transparentHex).toContain('rgba(255, 0, 0, 0.5)');
    });

    it('lightens colors by given percentage', () => {
      const black = '#000000';
      const lightened = lightenColor(black, 0.5);
      const rgba = parseColorToRgba(lightened);
      expect(rgba.r).toBeGreaterThan(0);
      expect(rgba.g).toBeGreaterThan(0);
      expect(rgba.b).toBeGreaterThan(0);
    });

    it('darkens colors by given percentage', () => {
      const white = '#ffffff';
      const darkened = darkenColor(white, 0.5);
      const rgba = parseColorToRgba(darkened);
      expect(rgba.r).toBeLessThan(255);
      expect(rgba.g).toBeLessThan(255);
      expect(rgba.b).toBeLessThan(255);
    });
  });

  describe('Gradient Stop Distribution (distributeGradientStops)', () => {
    it('automatically calculates equidistant offsets when none are provided', () => {
      const stops = [
        { color: '#ff0000' },
        { color: '#00ff00' },
        { color: '#0000ff' }
      ];
      const distributed = distributeGradientStops(stops);
      expect(distributed[0].offset).toBe(0);
      expect(distributed[1].offset).toBe(0.5);
      expect(distributed[2].offset).toBe(1);
    });

    it('preserves user-defined explicit offsets and fills missing ones linearly', () => {
      const stops = [
        { color: '#ff0000', offset: 0 },
        { color: '#ffff00' },
        { color: '#00ff00', offset: 0.8 },
        { color: '#0000ff', offset: 1.0 }
      ];
      const distributed = distributeGradientStops(stops);
      expect(distributed[0].offset).toBe(0);
      expect(distributed[1].offset).toBe(0.4); // halfway between 0 and 0.8
      expect(distributed[2].offset).toBe(0.8);
      expect(distributed[3].offset).toBe(1.0);
    });

    it('handles single stop gradient by returning 0 offset', () => {
      const distributed = distributeGradientStops([{ color: '#38bdf8' }]);
      expect(distributed).toHaveLength(1);
      expect(distributed[0].offset).toBe(0);
    });
  });

  describe('Blend Mode Mappings', () => {
    it('maps blend modes to standard Canvas 2D globalCompositeOperation', () => {
      expect(mapBlendMode('multiply')).toBe('multiply');
      expect(mapBlendMode('screen')).toBe('screen');
      expect(mapBlendMode('overlay')).toBe('overlay');
      expect(mapBlendMode('darken')).toBe('darken');
      expect(mapBlendMode('lighten')).toBe('lighten');
      expect(mapBlendMode('normal')).toBe('source-over');
      expect(mapBlendMode(undefined)).toBe('source-over');
    });

    it('maps blend modes to Photoshop PSD blend modes', () => {
      expect(mapBlendModeToPsd('multiply')).toBe('multiply');
      expect(mapBlendModeToPsd('screen')).toBe('screen');
      expect(mapBlendModeToPsd('overlay')).toBe('overlay');
      expect(mapBlendModeToPsd('color-dodge')).toBe('color dodge');
      expect(mapBlendModeToPsd('color-burn')).toBe('color burn');
      expect(mapBlendModeToPsd('hard-light')).toBe('hard light');
      expect(mapBlendModeToPsd('soft-light')).toBe('soft light');
      expect(mapBlendModeToPsd('normal')).toBe('normal');
    });
  });

  describe('CSS Filter String Parsing (parseFilterString)', () => {
    it('parses single blur filter with pixel unit', () => {
      const parsed = parseFilterString('blur(10px)');
      expect(parsed).toEqual([{ name: 'blur', args: ['10px'], raw: 'blur(10px)' }]);
    });

    it('parses chained filter functions', () => {
      const parsed = parseFilterString('blur(4px) saturate(1.5) contrast(120%)');
      expect(parsed).toHaveLength(3);
      expect(parsed[0].name).toBe('blur');
      expect(parsed[0].args).toEqual(['4px']);
      expect(parsed[1].name).toBe('saturate');
      expect(parsed[1].args).toEqual(['1.5']);
      expect(parsed[2].name).toBe('contrast');
      expect(parsed[2].args).toEqual(['120%']);
    });

    it('handles empty or none filter strings', () => {
      expect(parseFilterString('')).toEqual([]);
      expect(parseFilterString('none')).toEqual([]);
    });
  });
});
