import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execaNode, execa } from 'child_process';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import { createCli, startWatcher } from '../src/cli.js';

const execAsync = promisify(exec);

describe('Commander CLI Tool (toad)', () => {
  const testOutDir = path.resolve('tests/dist/cli_test');

  beforeEach(() => {
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testOutDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true, force: true });
    }
  });

  describe('Commander Configuration & Options', () => {
    it('configures program name, description, and version', () => {
      const cli = createCli();
      expect(cli.name()).toBe('toad');
      expect(cli.version()).toBe('1.0.0');
      expect(cli.description()).toContain('compiler');
    });

    it('defines build command with scale, format, out, fonts, watch, and quality options', () => {
      const cli = createCli();
      const buildCmd = cli.commands.find(c => c.name() === 'build');
      expect(buildCmd).toBeDefined();

      const optionNames = buildCmd!.options.map(o => o.long || o.short);
      expect(optionNames).toContain('--scale');
      expect(optionNames).toContain('--format');
      expect(optionNames).toContain('--out');
      expect(optionNames).toContain('--fonts');
      expect(optionNames).toContain('--watch');
      expect(optionNames).toContain('--quality');
    });
  });

  describe('CLI Help & Version Output', () => {
    it('outputs help text containing usage and commands', async () => {
      const { stdout } = await execAsync('node ./dist/cli.js build --help');
      expect(stdout).toContain('toad');
      expect(stdout).toContain('build [options] [entry]');
      expect(stdout).toContain('--scale');
      expect(stdout).toContain('--format');
      expect(stdout).toContain('--out');
      expect(stdout).toContain('--watch');
    });

    it('outputs version string with --version', async () => {
      const { stdout } = await execAsync('node ./dist/cli.js --version');
      expect(stdout.trim()).toBe('1.0.0');
    });
  });

  describe('CLI Build Invocations', () => {
    it('builds a PNG file with default settings via CLI', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const outDir = path.join(testOutDir, 'default_build');

      const cmd = `node ./dist/cli.js build "${fixture}" -o "${outDir}"`;
      const { stdout, stderr } = await execAsync(cmd);

      expect(stderr).toBe('');
      expect(stdout).toContain('Build completed');
      expect(fs.existsSync(path.join(outDir, 'sample_shapes.png'))).toBe(true);
    });

    it('supports direct invocation without explicit "build" keyword (default command)', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const outDir = path.join(testOutDir, 'direct_invoke');

      const cmd = `node ./dist/cli.js "${fixture}" -o "${outDir}" -f png`;
      const { stdout } = await execAsync(cmd);

      expect(stdout).toContain('Build completed');
      expect(fs.existsSync(path.join(outDir, 'sample_shapes.png'))).toBe(true);
    });

    it('builds PSD and JPEG files via CLI flags (-f psd, -f jpg)', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const outPsdDir = path.join(testOutDir, 'psd_build');
      const outJpgDir = path.join(testOutDir, 'jpg_build');

      await execAsync(`node ./dist/cli.js build "${fixture}" -f psd -o "${outPsdDir}"`);
      expect(fs.existsSync(path.join(outPsdDir, 'sample_shapes.psd'))).toBe(true);

      await execAsync(`node ./dist/cli.js build "${fixture}" -f jpg --quality 90 -o "${outJpgDir}"`);
      expect(fs.existsSync(path.join(outJpgDir, 'sample_shapes.jpg'))).toBe(true);
    });

    it('builds all formats simultaneously (-f all) at 2x scale (-s 2)', async () => {
      const fixture = 'tests/fixtures/sample_shapes.toad';
      const outDir = path.join(testOutDir, 'all_scale2');

      const cmd = `node ./dist/cli.js build "${fixture}" -f all -s 2 -o "${outDir}"`;
      const { stdout } = await execAsync(cmd);

      expect(stdout).toContain('Build completed');
      expect(fs.existsSync(path.join(outDir, 'sample_shapes.png'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'sample_shapes.jpg'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'sample_shapes.psd'))).toBe(true);
    });
  });

  describe('CLI Error Handling & Exit Codes', () => {
    it('exits with non-zero code on non-existent entry file', async () => {
      try {
        await execAsync('node ./dist/cli.js build non_existent_file_xyz123.toad');
        expect.unreachable('Should have thrown an error');
      } catch (err: any) {
        expect(err.code).not.toBe(0);
        expect(err.stderr || err.stdout).toContain('error');
      }
    });

    it('exits with non-zero code when missing required entry argument', async () => {
      try {
        await execAsync('node ./dist/cli.js build');
        expect.unreachable('Should have thrown an error');
      } catch (err: any) {
        expect(err.code).not.toBe(0);
      }
    });
  });

  describe('Watch Mode Engine', () => {
    it('initializes file watcher on entry and dependencies', async () => {
      const fixture = path.resolve('tests/fixtures/social_card.toad');
      const outDir = path.join(testOutDir, 'watch_test');

      const watcher = await startWatcher(fixture, {
        format: 'png',
        outDir
      });

      expect(watcher).toBeDefined();
      expect(fs.existsSync(path.join(outDir, 'social_card.png'))).toBe(true);

      // Close watcher to release file descriptors
      await watcher.close();
    });
  });
});
