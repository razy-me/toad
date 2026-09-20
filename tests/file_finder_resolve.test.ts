/**
 * tests/file_finder_resolve.test.ts
 * Tests for universal file finding and resolving (e.g. images, psd, motion).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { findAnyFile, resolveAnyFile } from '../src/utils/fileFinder.js';

describe('findAnyFile & resolveAnyFile', () => {
  const tmpFinderDir = path.resolve(process.cwd(), 'tests', 'tmp_finder_test');

  beforeAll(() => {
    fs.mkdirSync(tmpFinderDir, { recursive: true });
    fs.writeFileSync(path.join(tmpFinderDir, 'EHCNeuwied_SocialMedia_Becker5.png'), 'fake-png-content');
    fs.writeFileSync(path.join(tmpFinderDir, 'my-banner-layout.psd'), 'fake-psd-content');
    fs.writeFileSync(path.join(tmpFinderDir, 'intro-animation.toadm'), 'fake-toadm-content');
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpFinderDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. Directly resolves an existing relative or absolute path', async () => {
    const directPath = path.join(tmpFinderDir, 'EHCNeuwied_SocialMedia_Becker5.png');
    const resolved = await resolveAnyFile(directPath);
    expect(resolved).toBe(path.resolve(directPath));
  });

  it('2. Resolves file by bare filename with exact extension', async () => {
    const resolved = await resolveAnyFile('EHCNeuwied_SocialMedia_Becker5.png', {
      extensions: ['.png', '.jpg', '.webp', '.psd']
    });
    expect(resolved).toBeTruthy();
    expect(path.basename(resolved!)).toBe('EHCNeuwied_SocialMedia_Becker5.png');
  });

  it('3. Resolves file by bare stem without extension', async () => {
    const resolved = await resolveAnyFile('EHCNeuwied_SocialMedia_Becker5', {
      extensions: ['.png', '.jpg', '.webp', '.psd']
    });
    expect(resolved).toBeTruthy();
    expect(path.basename(resolved!)).toBe('EHCNeuwied_SocialMedia_Becker5.png');
  });

  it('4. Resolves PSD files with hyphen/underscore tolerance', async () => {
    const resolved = await resolveAnyFile('my_banner_layout', {
      extensions: ['.psd']
    });
    expect(resolved).toBeTruthy();
    expect(path.basename(resolved!)).toBe('my-banner-layout.psd');
  });

  it('5. Resolves TOAD Motion files (.toadm)', async () => {
    const resolved = await resolveAnyFile('intro-animation', {
      extensions: ['.toadm']
    });
    expect(resolved).toBeTruthy();
    expect(path.basename(resolved!)).toBe('intro-animation.toadm');
  });

  it('6. Returns null when file does not exist', async () => {
    const resolved = await resolveAnyFile('non_existent_file_xyz_123456.png', {
      extensions: ['.png', '.jpg']
    });
    expect(resolved).toBeNull();
  });
});
