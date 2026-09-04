import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  resolveSharedImage,
  estimateFilterPad,
  normalizeFilterCss,
  getImageCacheSize,
  clearImageCache,
  detectCanvasFilterSupport
} from '../../src/engine/imageCache.js';
import { generateShapePath } from '../../src/engine/shapeGenerators.js';
import { getIconPath, lucideIcons } from '../../src/engine/iconRegistry.js';
import { FontLoader } from '../../src/engine/fontLoader.js';
import { runInit } from '../../src/scaffold.js';
import { findToadFiles } from '../../src/utils/fileFinder.js';

describe('Unit Tests: Engine Helpers, Caches & Generators', () => {
  describe('Image Cache (imageCache.ts)', () => {
    beforeEach(() => {
      clearImageCache();
    });

    it('returns null for non-existent image paths', async () => {
      const img = await resolveSharedImage('./non_existent_image_12345.png');
      expect(img).toBeNull();
    });

    it('caches loaded images and reports cache size', async () => {
      const samplePng = path.resolve('tests/fixtures/assets/avatar.png');
      if (fs.existsSync(samplePng)) {
        const img1 = await resolveSharedImage(samplePng);
        expect(img1).toBeDefined();
        expect(getImageCacheSize()).toBe(1);

        const img2 = await resolveSharedImage(samplePng);
        expect(img2).toBe(img1); // Same cached instance
        expect(getImageCacheSize()).toBe(1);
      }
    });

    it('clears image cache properly', () => {
      clearImageCache();
      expect(getImageCacheSize()).toBe(0);
    });

    it('estimates padding required around filtered layers', () => {
      expect(estimateFilterPad('blur(10px)')).toBeGreaterThanOrEqual(30);
      expect(estimateFilterPad('drop-shadow(0px 20px 30px #000)')).toBeGreaterThanOrEqual(90);
      expect(estimateFilterPad('none')).toBe(8); // Min clamp
    });

    it('normalizes unitless CSS filter arguments by appending units', () => {
      expect(normalizeFilterCss('blur(10)')).toBe('blur(10px)');
      expect(normalizeFilterCss('hue-rotate(90)')).toBe('hue-rotate(90deg)');
      expect(normalizeFilterCss('brightness(1.5)')).toBe('brightness(1.5)');
    });

    it('detects canvas filter support without throwing', () => {
      const supported = detectCanvasFilterSupport();
      expect(typeof supported).toBe('boolean');
    });
  });

  describe('Shape Generators (shapeGenerators.ts)', () => {
    const box = { x: 0, y: 0, w: 100, h: 80 };

    it('generates triangle path geometry', () => {
      const path = generateShapePath('triangle', box);
      expect(path).toBe('M 50 0 L 100 80 L 0 80 Z');
    });

    it('generates star path with 10 vertices', () => {
      const path = generateShapePath('star', box);
      expect(path.startsWith('M ')).toBe(true);
      expect(path.endsWith('Z')).toBe(true);
      const vertices = path.split(/[ML]/).filter(Boolean);
      expect(vertices.length).toBe(10);
    });

    it('generates arrow path geometry', () => {
      const path = generateShapePath('arrow', box);
      expect(path).toContain('M 0 24');
      expect(path.endsWith('Z')).toBe(true);
    });

    it('generates cross path geometry', () => {
      const path = generateShapePath('cross', box);
      expect(path.startsWith('M ')).toBe(true);
      expect(path.endsWith('Z')).toBe(true);
    });

    it('returns empty string for unknown shape types', () => {
      expect(generateShapePath('unknown_shape', box)).toBe('');
    });
  });

  describe('Icon Registry (iconRegistry.ts)', () => {
    it('returns SVG path data for known Lucide icons', () => {
      expect(getIconPath('search')).toBe(lucideIcons['search']);
      expect(getIconPath('check')).toBe(lucideIcons['check']);
      expect(getIconPath('x')).toBe(lucideIcons['x']);
      expect(getIconPath('arrow-right')).toBe(lucideIcons['arrow-right']);
      expect(getIconPath('home')).toBe(lucideIcons['home']);
      expect(getIconPath('settings')).toBe(lucideIcons['settings']);
    });

    it('returns empty string for unregistered icons', () => {
      expect(getIconPath('non_existent_icon_name')).toBe('');
    });
  });

  describe('Font Loader (fontLoader.ts)', () => {
    it('returns available system and registered font families', () => {
      const families = FontLoader.getAvailableFamilies();
      expect(Array.isArray(families)).toBe(true);
      expect(families.length).toBeGreaterThan(0);
    });

    it('returns false when registering non-existent font files', () => {
      expect(FontLoader.registerFontFile('./non_existent_font.ttf')).toBe(false);
    });

    it('handles registering font directories safely', () => {
      const loaded = FontLoader.registerFontDirectory('./tests/fixtures/fonts');
      expect(Array.isArray(loaded)).toBe(true);
    });
  });

  describe('Project Scaffolder (scaffold.ts)', () => {
    const testDir = path.resolve('tests/dist/scaffold_test');

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('scaffolds a new toad project with main.toad and package.json', () => {
      const currentCwd = process.cwd();
      try {
        fs.mkdirSync(testDir, { recursive: true });
        process.chdir(testDir);

        runInit('my-design');
        const projectPath = path.join(testDir, 'my-design');

        expect(fs.existsSync(projectPath)).toBe(true);
        expect(fs.existsSync(path.join(projectPath, 'main.toad'))).toBe(true);
        expect(fs.existsSync(path.join(projectPath, 'package.json'))).toBe(true);

        const mainContent = fs.readFileSync(path.join(projectPath, 'main.toad'), 'utf-8');
        expect(mainContent).toContain('canvas {');
        expect(mainContent).toContain('toad is ready!');

        const pkgContent = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
        expect(pkgContent.name).toBe('my-design');
      } finally {
        process.chdir(currentCwd);
      }
    });

    it('throws error when trying to scaffold into an existing directory', () => {
      const currentCwd = process.cwd();
      try {
        fs.mkdirSync(testDir, { recursive: true });
        process.chdir(testDir);

        fs.mkdirSync(path.join(testDir, 'existing-project'), { recursive: true });
        expect(() => runInit('existing-project')).toThrow("already exists");
      } finally {
        process.chdir(currentCwd);
      }
    });
  });

  describe('File Finder Utility (fileFinder.ts)', () => {
    it('finds existing file by direct relative path', async () => {
      const fixture = 'tests/fixtures/social_card.toad';
      const results = await findToadFiles(fixture);
      expect(results).toHaveLength(1);
      expect(results[0].toLowerCase()).toContain('social_card.toad');
    });

    it('throws DIRECTORY_PATH error when target is a folder', async () => {
      await expect(findToadFiles('tests/fixtures')).rejects.toThrow('is a directory');
    });

    it('returns empty array when search query matches no files', async () => {
      const results = await findToadFiles('completely_impossible_filename_xyz987654');
      expect(results).toHaveLength(0);
    });
  });
});
