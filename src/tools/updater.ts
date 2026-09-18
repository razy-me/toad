import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { c } from '../cli.js';

export interface UpdateOptions {
  checkOnly?: boolean;
  force?: boolean;
}

export interface UpdateResult {
  currentVersion: string;
  latestVersion?: string;
  updated: boolean;
  message: string;
}

/**
 * Determines the installation root directory of TOAD.
 */
export function getToadRootDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  // Current file is in dist/tools/updater.js or src/tools/updater.ts
  // Two levels up brings us to project root
  return path.resolve(path.dirname(currentFile), '..', '..');
}

/**
 * Checks if the directory is a Git repository.
 */
export function isGitRepo(dir: string): boolean {
  try {
    return fs.existsSync(path.join(dir, '.git'));
  } catch {
    return false;
  }
}

/**
 * Fetches the latest release or repository info from GitHub.
 */
export async function getLatestGitHubInfo(): Promise<{ tag: string; name?: string; body?: string } | null> {
  try {
    const res = await fetch('https://api.github.com/repos/razy-me/toad/releases/latest', {
      headers: {
        'User-Agent': 'toad-updater'
      }
    });
    if (res.ok) {
      const data = await res.json();
      return {
        tag: data.tag_name,
        name: data.name,
        body: data.body
      };
    }
    // Fallback: If no releases exist yet, query latest commit on main
    const commitRes = await fetch('https://api.github.com/repos/razy-me/toad/commits/main', {
      headers: {
        'User-Agent': 'toad-updater'
      }
    });
    if (commitRes.ok) {
      const commitData = await commitRes.json();
      const shortSha = commitData.sha?.substring(0, 7) || 'latest';
      return {
        tag: shortSha,
        name: 'Latest commit (' + shortSha + ')',
        body: commitData.commit?.message
      };
    }
  } catch {
    // Network / offline
  }
  return null;
}

/**
 * Reads the current TOAD version from package.json.
 */
export function getCurrentVersion(rootDir: string): string {
  try {
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return pkg.version || '1.0.0';
    }
  } catch {}
  return '1.0.0';
}

/**
 * Performs the update logic for TOAD.
 */
export async function updateToad(options: UpdateOptions = {}): Promise<UpdateResult> {
  const rootDir = getToadRootDir();
  const currentVersion = getCurrentVersion(rootDir);
  const isGit = isGitRepo(rootDir);

  console.log(c.bold('🔄 Checking for TOAD updates...'));
  console.log(c.dim('   Installed version: ') + c.yellow(currentVersion));
  console.log(c.dim('   Installation path: ') + c.dim(rootDir));

  const gitHubInfo = await getLatestGitHubInfo();

  if (options.checkOnly) {
    if (gitHubInfo) {
      console.log('\n' + c.green('✔') + ' Latest available version on GitHub: ' + c.bold(c.cyan(gitHubInfo.tag)));
      if (gitHubInfo.name) console.log('   ' + c.dim(gitHubInfo.name));
    } else {
      console.log('\n' + c.yellow('ℹ') + ' Could not reach GitHub to check for updates (offline or rate limit).');
    }
    return {
      currentVersion,
      latestVersion: gitHubInfo?.tag,
      updated: false,
      message: 'Check completed.'
    };
  }

  // Strategy 1: Git-based update (when developing or installed via git clone)
  if (isGit) {
    console.log('\n' + c.cyan('⬇ Pulling latest changes via Git...'));
    try {
      // Check for uncommitted changes
      const status = execSync('git status --porcelain', { cwd: rootDir, encoding: 'utf-8' }).trim();
      if (status && !options.force) {
        console.warn('\n' + c.yellow('⚠ Warning:') + ' You have uncommitted local changes in TOAD directory.');
        console.warn('  To overwrite, pass ' + c.cyan('--force') + ', or commit/stash your changes.');
        return {
          currentVersion,
          updated: false,
          message: 'Aborted: local changes exist.'
        };
      }

      const pullOutput = execSync('git pull origin main', { cwd: rootDir, encoding: 'utf-8' });
      console.log(c.dim(pullOutput.trim()));

      if (pullOutput.includes('Already up to date.') && !options.force) {
        console.log('\n' + c.green('✔') + ' TOAD is already up to date!');
        return {
          currentVersion,
          updated: false,
          message: 'Already up to date.'
        };
      }

      console.log('\n' + c.cyan('⚙ Rebuilding TOAD...'));
      execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
      execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

      const newVersion = getCurrentVersion(rootDir);
      console.log('\n' + c.green('✔') + ' Successfully updated TOAD to version ' + c.bold(c.green(newVersion)) + '!');
      return {
        currentVersion,
        latestVersion: newVersion,
        updated: true,
        message: 'Updated successfully via git.'
      };
    } catch (err: any) {
      throw new Error('Git update failed: ' + (err.message || String(err)));
    }
  }

  // Strategy 2: Tarball / GitHub Download update (for Standalone / One-line installer)
  console.log('\n' + c.cyan('⬇ Downloading latest TOAD release from GitHub...'));
  const tarballUrl = 'https://api.github.com/repos/razy-me/toad/tarball/main';

  try {
    const tempDir = path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'toad-updater-extract');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    // Download tarball
    const res = await fetch(tarballUrl, { headers: { 'User-Agent': 'toad-updater' } });
    if (!res.ok) {
      throw new Error('Failed to download tarball: ' + res.statusText);
    }
    const arrayBuffer = await res.arrayBuffer();
    const tarFilePath = path.join(tempDir, 'toad.tar.gz');
    fs.writeFileSync(tarFilePath, Buffer.from(arrayBuffer));

    // Extract using tar command
    execSync(`tar -xzf "${tarFilePath}" -C "${tempDir}"`);

    // Find extracted directory
    const entries = fs.readdirSync(tempDir, { withFileTypes: true });
    const extractedFolder = entries.find(e => e.isDirectory() && e.name.startsWith('razy-me-toad-'))?.name;
    if (!extractedFolder) {
      throw new Error('Could not locate extracted release files.');
    }

    const sourcePath = path.join(tempDir, extractedFolder);

    console.log(c.cyan('📦 Applying updates...'));

    if (process.platform === 'win32') {
      // On Windows, running node / dist files can be locked by the OS.
      // We spawn an independent, detached runner (cmd.exe) that waits 500ms for this node
      // process to exit, then copies files into place and removes temp files.
      const swapScript = path.join(tempDir, 'toad_swap.bat');
      const targetDir = rootDir;
      const batContent = [
        '@echo off',
        'chcp 65001 >nul',
        'timeout /t 1 /nobreak >nul',
        `xcopy "${sourcePath}\\*" "${targetDir}\\" /s /e /y /q >nul`,
        `rd /s /q "${tempDir}" >nul 2>&1`,
        'echo [toad] Update completed successfully.',
        'exit 0'
      ].join('\r\n');
      fs.writeFileSync(swapScript, batContent, 'ascii');

      const child = spawn('cmd.exe', ['/c', swapScript], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      console.log('\n' + c.green('✔') + ' Update staged successfully!');
      console.log(c.dim('  TOAD is applying final changes in the background and will be ready in 1 second.\n'));

      return {
        currentVersion,
        latestVersion: gitHubInfo?.tag,
        updated: true,
        message: 'Update scheduled and applied via detached runner.'
      };
    } else {
      // Unix systems allow unlinking and replacing running files in-place
      fs.cpSync(sourcePath, rootDir, {
        recursive: true,
        filter: (src) => {
          return !src.includes('runtime') && !src.includes('node_modules');
        }
      });

      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}

      const newVersion = getCurrentVersion(rootDir);
      console.log('\n' + c.green('✔') + ' Successfully updated TOAD to ' + c.bold(c.green(newVersion)) + '!');

      return {
        currentVersion,
        latestVersion: newVersion,
        updated: true,
        message: 'Updated successfully from GitHub archive.'
      };
    }
  } catch (err: any) {
    throw new Error('Self-update failed: ' + (err.message || String(err)));
  }
}

