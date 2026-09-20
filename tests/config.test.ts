/**
 * tests/config.test.ts
 * Tests for TOAD Configuration Engine (toad config / toad settings).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {
  getConfigPath,
  getConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  resetConfig,
  DEFAULT_CONFIG,
  addWorkspace,
  removeWorkspace,
  getWorkspaces,
  addSearchPath,
  removeSearchPath,
  getSearchPaths,
  setSearchPaths
} from '../src/utils/fileFinder.js';

describe('TOAD Configuration & Settings Engine', () => {
  const cfgPath = getConfigPath();
  let originalConfigRaw: string | null = null;

  beforeEach(() => {
    if (originalConfigRaw === null) {
      try {
        if (fs.existsSync(cfgPath)) {
          originalConfigRaw = fs.readFileSync(cfgPath, 'utf-8');
        }
      } catch {}
    }
  });

  afterAll(() => {
    try {
      if (originalConfigRaw !== null) {
        fs.writeFileSync(cfgPath, originalConfigRaw, 'utf-8');
      } else if (fs.existsSync(cfgPath)) {
        fs.unlinkSync(cfgPath);
      }
    } catch {}
  });

  it('1. Returns expected configuration file path and defaults', () => {
    expect(cfgPath).toBe(path.join(os.homedir(), '.toadrc.json'));
    const cfg = getConfig();
    expect(cfg).toBeDefined();
    expect(cfg.defaultFormat).toBeDefined();
    expect(typeof cfg.defaultQuality).toBe('number');
    expect(typeof cfg.defaultScale).toBe('number');
    expect(Array.isArray(cfg.workspaces)).toBe(true);
    expect(Array.isArray(cfg.searchPaths)).toBe(true);
  });

  it('2. Successfully sets and validates typed configuration values', () => {
    // Valid format update
    const resFormat = setConfigValue('defaultFormat', 'webp');
    expect(resFormat.success).toBe(true);
    expect(getConfigValue('defaultFormat')).toBe('webp');

    // Valid quality update (string to number)
    const resQuality = setConfigValue('defaultQuality', '88');
    expect(resQuality.success).toBe(true);
    expect(getConfigValue('defaultQuality')).toBe(88);

    // Valid scale update
    const resScale = setConfigValue('defaultScale', '2');
    expect(resScale.success).toBe(true);
    expect(getConfigValue('defaultScale')).toBe(2);

    // Valid aiDevice update
    const resDevice = setConfigValue('aiDevice', 'dml');
    expect(resDevice.success).toBe(true);
    expect(getConfigValue('aiDevice')).toBe('dml');

    // Valid boolean conversion
    const resAuto = setConfigValue('autoUpdate', 'false');
    expect(resAuto.success).toBe(true);
    expect(getConfigValue('autoUpdate')).toBe(false);
  });

  it('3. Rejects invalid configuration values with informative errors', () => {
    // Quality out of bounds
    const resQTooHigh = setConfigValue('defaultQuality', '150');
    expect(resQTooHigh.success).toBe(false);
    expect(resQTooHigh.message).toContain('between 1 and 100');

    // Invalid image format
    const resBadFmt = setConfigValue('defaultFormat', 'bmp_unsupported');
    expect(resBadFmt.success).toBe(false);
    expect(resBadFmt.message).toContain('Format must be one of');

    // Invalid aiDevice
    const resBadDevice = setConfigValue('aiDevice', 'quantum_core');
    expect(resBadDevice.success).toBe(false);
    expect(resBadDevice.message).toContain('aiDevice must be one of');
  });

  it('4. Resets configuration to defaults', () => {
    setConfigValue('defaultFormat', 'svg');
    setConfigValue('defaultQuality', '42');
    expect(getConfigValue('defaultFormat')).toBe('svg');

    const resetData = resetConfig();
    expect(resetData.defaultFormat).toBe('png');
    expect(resetData.defaultQuality).toBe(90);

    const reloaded = getConfig();
    expect(reloaded.defaultFormat).toBe('png');
    expect(reloaded.defaultQuality).toBe(90);
  });

  it('5. Maintains workspace management compatibility', () => {
    const cwd = process.cwd();
    const addRes = addWorkspace(cwd);
    expect(addRes.success).toBe(true);
    expect(getWorkspaces().map(w => path.resolve(w).toLowerCase())).toContain(cwd.toLowerCase());

    const remRes = removeWorkspace(cwd);
    expect(remRes.success).toBe(true);
  });

  it('6. Manages priority searchPaths and aliases them with workspaces', () => {
    const testDir = path.join(os.homedir(), 'Downloads');
    if (fs.existsSync(testDir)) {
      const addRes = addSearchPath(testDir);
      expect(addRes.success).toBe(true);
      expect(getSearchPaths().map(p => path.resolve(p).toLowerCase())).toContain(testDir.toLowerCase());
      expect(getWorkspaces().map(p => path.resolve(p).toLowerCase())).toContain(testDir.toLowerCase());

      const remRes = removeSearchPath(testDir);
      expect(remRes.success).toBe(true);
      expect(getSearchPaths().map(p => path.resolve(p).toLowerCase())).not.toContain(testDir.toLowerCase());
    }

    // Reordering via setSearchPaths
    const dirA = os.homedir();
    const dirB = path.join(os.homedir(), 'Downloads');
    if (fs.existsSync(dirB)) {
      setSearchPaths([dirA, dirB]);
      expect(getSearchPaths().map(p => path.resolve(p).toLowerCase())).toEqual([dirA.toLowerCase(), dirB.toLowerCase()]);

      // Reorder
      setSearchPaths([dirB, dirA]);
      expect(getSearchPaths().map(p => path.resolve(p).toLowerCase())).toEqual([dirB.toLowerCase(), dirA.toLowerCase()]);
    }
  });

  it('7. Sets and validates the 7 new configuration settings', () => {
    // 1. searchIgnoreDirs
    const resIgnore = setConfigValue('searchIgnoreDirs', 'cache, temp, backup');
    expect(resIgnore.success).toBe(true);
    expect(getConfigValue('searchIgnoreDirs')).toEqual(['cache', 'temp', 'backup']);

    // 2. searchTimeoutMs (up to 120s / 120,000ms)
    const resTimeout = setConfigValue('searchTimeoutMs', '8000');
    expect(resTimeout.success).toBe(true);
    expect(getConfigValue('searchTimeoutMs')).toBe(8000);

    const resTimeoutMax = setConfigValue('searchTimeoutMs', '120000');
    expect(resTimeoutMax.success).toBe(true);
    expect(getConfigValue('searchTimeoutMs')).toBe(120000);

    const resTimeoutOverMax = setConfigValue('searchTimeoutMs', '125000');
    expect(resTimeoutOverMax.success).toBe(false);

    const resTimeoutInvalid = setConfigValue('searchTimeoutMs', '100');
    expect(resTimeoutInvalid.success).toBe(false);

    // 3. defaultOutputDir
    const resOutDir = setConfigValue('defaultOutputDir', './dist');
    expect(resOutDir.success).toBe(true);
    expect(getConfigValue('defaultOutputDir')).toBe('./dist');

    // 4. outputNamingPattern
    const resPattern = setConfigValue('outputNamingPattern', '{name}_{width}x{height}{scale}');
    expect(resPattern.success).toBe(true);
    expect(getConfigValue('outputNamingPattern')).toBe('{name}_{width}x{height}{scale}');

    // 5. overwriteExisting
    const resOverwrite = setConfigValue('overwriteExisting', 'false');
    expect(resOverwrite.success).toBe(true);
    expect(getConfigValue('overwriteExisting')).toBe(false);

    // 6. defaultFps (including 44 and 90 FPS)
    const resFps = setConfigValue('defaultFps', '30');
    expect(resFps.success).toBe(true);
    expect(getConfigValue('defaultFps')).toBe(30);

    const resFps44 = setConfigValue('defaultFps', '44');
    expect(resFps44.success).toBe(true);
    expect(getConfigValue('defaultFps')).toBe(44);

    const resFps90 = setConfigValue('defaultFps', '90');
    expect(resFps90.success).toBe(true);
    expect(getConfigValue('defaultFps')).toBe(90);

    const resBadFps = setConfigValue('defaultFps', '500');
    expect(resBadFps.success).toBe(false);

    // 7. defaultMotionFormat
    const resMotionFmt = setConfigValue('defaultMotionFormat', 'webm');
    expect(resMotionFmt.success).toBe(true);
    expect(getConfigValue('defaultMotionFormat')).toBe('webm');

    const resBadMotionFmt = setConfigValue('defaultMotionFormat', 'flv');
    expect(resBadMotionFmt.success).toBe(false);
  });

  it('8. formatOutputFileName and resolveOutputDestination interpolate variables correctly', async () => {
    const { formatOutputFileName, resolveOutputDestination } = await import('../src/utils/fileFinder.js');

    const formatted = formatOutputFileName('{name}_{width}x{height}{scale}_{date}_{rand4}', {
      name: 'banner',
      width: 1920,
      height: 1080,
      scale: '@2x',
      format: 'png'
    });
    expect(formatted).toMatch(/^banner_1920x1080@2x_\d{4}-\d{2}-\d{2}_[a-z0-9]{4}$/);

    const singleRand = formatOutputFileName('{rand}', { name: 'test' });
    expect(singleRand).toMatch(/^[a-z0-9]$/);

    // Test output path resolution
    const outPath = resolveOutputDestination('C:\\Users\\test\\project.toad', undefined, 'png', {
      name: 'project',
      scale: '',
      width: 800,
      height: 600
    });
    expect(outPath).toContain('project');
    expect(outPath.endsWith('.png')).toBe(true);
  });
});
