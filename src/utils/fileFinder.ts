/**
 * src/utils/fileFinder.ts
 * Blazing fast decentralized disk search for .toad files across drives and user folders.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';
import { c } from '../cli.js';

const IGNORED_FOLDERS = new Set([
  'node_modules', '.git', 'appdata', '$recycle.bin', 'system volume information',
  'windows', 'program files', 'program files (x86)', 'programdata', '.vscode', '.gemini',
  'dist', 'build', '.cache', 'temp', 'tmp', '$winreagent', 'config.msi', 'perflogs',
  '.antigravity-ide', '.next', '.nuxt', '.turbo', '.angular', 'vendor', '$sysreset',
  'recovery', 'msys64', 'inetpub', 'intel', 'users', 'dokumente und einstellungen',
  'programme', 'application data'
]);

/**
 * Checks if a given path or directory name should be skipped.
 * Explicitly ignores OS system folders, \toad\tests\, and \toad\the_seed\.
 */
export function isIgnoredPath(targetPath: string): boolean {
  const normalized = targetPath.replace(/\\/g, '/').toLowerCase();
  
  // Allow test sandbox during testing
  if (process.env.VITEST) {
    if (normalized.includes('/toad/tests/tmp_finder')) return false;
    if (normalized.endsWith('/toad/tests') || normalized === 'tests') return false;
  }

  // Specific exclusions requested: \toad\tests\ and \toad\the_seed\
  if (normalized.includes('/toad/tests') || normalized.endsWith('/toad/tests') ||
      normalized.includes('/toad/the_seed') || normalized.endsWith('/toad/the_seed')) {
    return true;
  }

  // Segment-based checks against system / build / dependency folders
  const segments = normalized.split('/').filter(Boolean);
  for (const seg of segments) {
    if (IGNORED_FOLDERS.has(seg) || seg.startsWith('$') || seg.startsWith('.')) {
      return true;
    }
  }

  return false;
}

// Configuration file for user-defined workspaces
const CONFIG_FILE = path.join(os.homedir(), '.toadrc.json');

export interface ToadConfig {
  workspaces?: string[];
}

export function getWorkspaces(): string[] {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const data: ToadConfig = JSON.parse(raw);
      if (Array.isArray(data.workspaces)) {
        return data.workspaces.filter(dir => {
          try {
            return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
          } catch {
            return false;
          }
        });
      }
    }
  } catch {}
  return [];
}

export function addWorkspace(dirPath: string): { success: boolean; message: string; workspaces: string[] } {
  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return { success: false, message: `Verzeichnis existiert nicht: ${resolved}`, workspaces: getWorkspaces() };
  }

  let currentConfig: ToadConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      currentConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}

  const currentWorkspaces = Array.isArray(currentConfig.workspaces) ? currentConfig.workspaces : [];
  const normalizedNew = resolved.toLowerCase();
  if (currentWorkspaces.some(w => path.resolve(w).toLowerCase() === normalizedNew)) {
    return { success: true, message: `Workspace ist bereits registriert: ${resolved}`, workspaces: currentWorkspaces };
  }

  currentWorkspaces.push(resolved);
  currentConfig.workspaces = currentWorkspaces;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf-8');
  return { success: true, message: `Workspace hinzugefügt: ${resolved}`, workspaces: currentWorkspaces };
}

export function removeWorkspace(dirPath: string): { success: boolean; message: string; workspaces: string[] } {
  const resolved = path.resolve(dirPath);
  let currentConfig: ToadConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      currentConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}

  const currentWorkspaces = Array.isArray(currentConfig.workspaces) ? currentConfig.workspaces : [];
  const normalized = resolved.toLowerCase();
  const filtered = currentWorkspaces.filter(w => path.resolve(w).toLowerCase() !== normalized);

  if (filtered.length === currentWorkspaces.length) {
    return { success: false, message: `Workspace nicht gefunden: ${dirPath}`, workspaces: currentWorkspaces };
  }

  currentConfig.workspaces = filtered;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf-8');
  return { success: true, message: `Workspace entfernt: ${resolved}`, workspaces: filtered };
}

// Persistent cache path for recently discovered .toad files across sessions
const CACHE_FILE = path.join(os.tmpdir(), 'toad_file_cache.json');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface FileCacheData {
  timestamp: number;
  files: string[];
}

function loadCache(): string[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const data: FileCacheData = JSON.parse(raw);
      if (Date.now() - data.timestamp < CACHE_TTL_MS && Array.isArray(data.files)) {
        return data.files;
      }
    }
  } catch {}
  return [];
}

function saveCache(newFiles: string[]): void {
  try {
    const existing = new Set(loadCache());
    for (const f of newFiles) {
      existing.add(f);
    }
    const data: FileCacheData = {
      timestamp: Date.now(),
      files: Array.from(existing).filter(f => {
        try {
          return fs.existsSync(f);
        } catch {
          return false;
        }
      })
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf-8');
  } catch {}
}

/**
 * Searches directories breadth-first for matching .toad files.
 */
function searchDir(
  dir: string,
  targetFileName: string,
  results: string[],
  seenPaths: Set<string>,
  maxDepth = 5,
  currentDepth = 0
): void {
  if (currentDepth > maxDepth || results.length >= 25) return;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const subdirs: string[] = [];

    for (const entry of entries) {
      const name = entry.name;
      const lower = name.toLowerCase();

      const fullPath = path.join(dir, name);

      // Skip ignored and hidden directories
      if (isIgnoredPath(fullPath) || isIgnoredPath(name) || lower.startsWith('$') || lower.startsWith('.')) {
        continue;
      }

      if (entry.isFile()) {
        const lowerNoExt = lower.endsWith('.toad') ? lower.slice(0, -5) : lower;
        const targetNoExt = targetFileName.endsWith('.toad') ? targetFileName.slice(0, -5) : targetFileName;

        const isExactMatch =
          lower === targetFileName ||
          lower === targetFileName + '.toad' ||
          (targetFileName.endsWith('.toad') && lower === targetFileName);

        // Normalize hyphens and underscores (e.g. velora_nova matches velora-nova)
        const isFuzzyHyphenMatch =
          lower.endsWith('.toad') &&
          lowerNoExt.replace(/[-_]/g, '') === targetNoExt.replace(/[-_]/g, '');

        if (isExactMatch || isFuzzyHyphenMatch) {
          const resolved = path.resolve(fullPath);
          const normalized = resolved.toLowerCase();
          if (!seenPaths.has(normalized)) {
            seenPaths.add(normalized);
            results.push(resolved);
          }
        }
      } else if (entry.isDirectory()) {
        if (!IGNORED_FOLDERS.has(lower)) {
          subdirs.push(fullPath);
        }
      }
    }

    for (const sub of subdirs) {
      if (results.length >= 25) break;
      searchDir(sub, targetFileName, results, seenPaths, maxDepth, currentDepth + 1);
    }
  } catch {}
}

/**
 * Scans available logical drives on the host OS.
 */
function getSystemDrives(): string[] {
  if (process.platform === 'win32') {
    const drives = new Set<string>();

    // Prioritize known active drives from environment and current working directory
    const activeCandidates = [
      process.env.SystemDrive ? process.env.SystemDrive.toUpperCase().slice(0, 2) + ':\\' : 'C:\\',
      process.env.HOMEDRIVE ? process.env.HOMEDRIVE.toUpperCase().slice(0, 2) + ':\\' : undefined,
      process.cwd().slice(0, 2).toUpperCase() + ':\\'
    ];
    for (const cand of activeCandidates) {
      if (cand && /^[C-Z]:\\$/i.test(cand)) {
        try {
          if (fs.existsSync(cand)) {
            drives.add(cand);
          }
        } catch {}
      }
    }

    // Probe remaining drive letters starting strictly from C (ASCII 67), skipping legacy floppy letters A and B
    for (let i = 67; i <= 90; i++) {
      const drive = String.fromCharCode(i) + ':\\';
      if (drives.has(drive)) continue;
      try {
        if (fs.existsSync(drive)) {
          drives.add(drive);
        }
      } catch {}
    }
    return Array.from(drives);
  }
  return ['/'];
}

/**
 * Finds all matching .toad files across cwd, user directories, and system drives in milliseconds.
 */
export async function findToadFiles(query: string): Promise<string[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const targetBase = normalizedQuery.endsWith('.toad') ? normalizedQuery : normalizedQuery + '.toad';

  // 1. Direct path check (instant)
  const resolvedDirect = path.resolve(query);
  if (fs.existsSync(resolvedDirect)) {
    if (fs.statSync(resolvedDirect).isDirectory()) {
      const err: any = new Error(`Entry path is a directory, expected a .toad file: ${resolvedDirect}`);
      err.code = 'DIRECTORY_PATH';
      throw err;
    }
    saveCache([resolvedDirect]);
    return [resolvedDirect];
  }
  const resolvedWithExt = path.resolve(query + '.toad');
  if (fs.existsSync(resolvedWithExt)) {
    if (fs.statSync(resolvedWithExt).isDirectory()) {
      const err: any = new Error(`Entry path is a directory, expected a .toad file: ${resolvedWithExt}`);
      err.code = 'DIRECTORY_PATH';
      throw err;
    }
    saveCache([resolvedWithExt]);
    return [resolvedWithExt];
  }

  const results: string[] = [];
  const seenPaths = new Set<string>();

  // 2. Fast Tier 1: Search current working directory (depth 5)
  searchDir(process.cwd(), targetBase, results, seenPaths, 5, 0);
  if (results.length > 0) {
    saveCache(results);
    return results;
  }

  // In test or CI environments, do not traverse external directories
  if (process.env.VITEST || process.env.CI || process.env.NODE_ENV === 'test') {
    return results;
  }

  // 2.5 Preferred Workspaces (Highest priority outside CWD)
  const configuredWorkspaces = getWorkspaces();
  for (const ws of configuredWorkspaces) {
    if (!seenPaths.has(ws.toLowerCase())) {
      searchDir(ws, targetBase, results, seenPaths, 5, 0);
      if (results.length > 0) {
        saveCache(results);
        return results;
      }
    }
  }

  // 3. Fast Tier 2: Check disk cache of previously discovered .toad files
  const cachedFiles = loadCache();
  const targetNoExt = targetBase.endsWith('.toad') ? targetBase.slice(0, -5) : targetBase;
  for (const cached of cachedFiles) {
    const base = path.basename(cached).toLowerCase();
    const baseNoExt = base.endsWith('.toad') ? base.slice(0, -5) : base;
    const isExact = base === targetBase || base === targetBase + '.toad';
    const isFuzzy = base.endsWith('.toad') && baseNoExt.replace(/[-_]/g, '') === targetNoExt.replace(/[-_]/g, '');

    if (isExact || isFuzzy) {
      if (fs.existsSync(cached)) {
        const resolved = path.resolve(cached);
        const normalized = resolved.toLowerCase();
        if (!seenPaths.has(normalized)) {
          seenPaths.add(normalized);
          results.push(resolved);
        }
      }
    }
  }
  if (results.length > 0) {
    return results;
  }

  // 4. Fast Tier 3: Search common user project directories (depth 4)
  const home = os.homedir();
  if (home) {
    const commonDirs = ['Desktop', 'Downloads', 'Documents', 'Projects', 'toad', 'dev', 'workspace']
      .map(sub => path.join(home, sub))
      .filter(p => fs.existsSync(p));

    for (const dir of commonDirs) {
      if (!seenPaths.has(dir.toLowerCase())) {
        searchDir(dir, targetBase, results, seenPaths, 4, 0);
        if (results.length > 0) {
          saveCache(results);
          return results;
        }
      }
    }
  }

  // 5. Fast Tier 4: Search root drive project folders (e.g. C:\toad, C:\Projects, C:\dev)
  const drives = getSystemDrives();
  const rootCandidates = ['toad', 'projects', 'dev', 'workspace', 'coding', 'designs', 'toad-projects'];

  for (const drive of drives) {
    for (const candidate of rootCandidates) {
      const candidatePath = path.join(drive, candidate);
      if (fs.existsSync(candidatePath) && !seenPaths.has(candidatePath.toLowerCase())) {
        searchDir(candidatePath, targetBase, results, seenPaths, 4, 0);
        if (results.length > 0) {
          saveCache(results);
          return results;
        }
      }
    }
  }

  // 6. Fast Tier 5: Scan top-level folders on system drives (skipping OS, Users, and Program files)
  for (const drive of drives) {
    try {
      const entries = fs.readdirSync(drive, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const lower = entry.name.toLowerCase();
        if (IGNORED_FOLDERS.has(lower) || lower.startsWith('$') || lower.startsWith('.')) {
          continue;
        }
        const full = path.join(drive, entry.name);
        if (!seenPaths.has(full.toLowerCase())) {
          searchDir(full, targetBase, results, seenPaths, 3, 0);
          if (results.length > 0) {
            saveCache(results);
            return results;
          }
        }
      }
    } catch {}
  }

  if (results.length > 0) {
    saveCache(results);
  }

  return results;
}

export interface ToadFileInfo {
  path: string;
  name: string;
  size: number;
  mtime: Date;
}

/**
 * Recursively collects all .toad files within a directory tree.
 */
function collectToadFiles(
  dir: string,
  results: Map<string, ToadFileInfo>,
  seenDirs: Set<string>,
  maxDepth = 5,
  currentDepth = 0
): void {
  if (currentDepth > maxDepth) return;

  let resolvedDir: string;
  try {
    resolvedDir = path.resolve(dir);
  } catch {
    return;
  }
  const dirKey = resolvedDir.toLowerCase();
  if (seenDirs.has(dirKey)) return;
  seenDirs.add(dirKey);

  try {
    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    const subdirs: string[] = [];

    for (const entry of entries) {
      const name = entry.name;
      const lower = name.toLowerCase();

      const fullPath = path.join(resolvedDir, name);

      // Skip ignored and hidden directories
      if (isIgnoredPath(fullPath) || isIgnoredPath(name) || lower.startsWith('$') || lower.startsWith('.')) {
        continue;
      }

      if (entry.isFile()) {
        if (lower.endsWith('.toad')) {
          const resolved = path.resolve(fullPath);
          const key = resolved.toLowerCase();
          if (!results.has(key)) {
            try {
              const stat = fs.statSync(resolved);
              results.set(key, {
                path: resolved,
                name,
                size: stat.size,
                mtime: stat.mtime
              });
            } catch {
              results.set(key, {
                path: resolved,
                name,
                size: 0,
                mtime: new Date()
              });
            }
          }
        }
      } else if (entry.isDirectory()) {
        if (!isIgnoredPath(fullPath) && !isIgnoredPath(lower)) {
          subdirs.push(fullPath);
        }
      }
    }

    for (const sub of subdirs) {
      collectToadFiles(sub, results, seenDirs, maxDepth, currentDepth + 1);
    }
  } catch {}
}

/**
 * Searches the entire system (CWD, workspaces, user directories, and system drives)
 * and returns all discovered .toad files with metadata.
 */
export async function listAllToadFiles(options?: { scanDirectories?: string[] }): Promise<ToadFileInfo[]> {
  const results = new Map<string, ToadFileInfo>();
  const seenDirs = new Set<string>();

  // If specific scan directories were explicitly provided (e.g. for testing)
  if (options?.scanDirectories && options.scanDirectories.length > 0) {
    for (const d of options.scanDirectories) {
      if (fs.existsSync(d)) {
        collectToadFiles(d, results, seenDirs, 6, 0);
      }
    }
    return Array.from(results.values()).sort((a, b) => a.path.localeCompare(b.path));
  }

  // 1. Current working directory (depth 5)
  if (!isIgnoredPath(process.cwd())) {
    collectToadFiles(process.cwd(), results, seenDirs, 5, 0);
  }

  // 2. Configured workspaces from .toadrc.json
  const workspaces = getWorkspaces();
  for (const ws of workspaces) {
    if (fs.existsSync(ws) && !isIgnoredPath(ws)) {
      collectToadFiles(ws, results, seenDirs, 5, 0);
    }
  }

  // 3. Persistent cache of previously found files
  const cachedFiles = loadCache();
  for (const cached of cachedFiles) {
    if (cached.toLowerCase().endsWith('.toad') && !isIgnoredPath(cached)) {
      const key = path.resolve(cached).toLowerCase();
      if (!results.has(key) && fs.existsSync(cached)) {
        try {
          const stat = fs.statSync(cached);
          results.set(key, {
            path: path.resolve(cached),
            name: path.basename(cached),
            size: stat.size,
            mtime: stat.mtime
          });
        } catch {}
      }
    }
  }

  // In test/CI environments, do not traverse external directories unless explicitly asked
  if (process.env.VITEST || process.env.CI || process.env.NODE_ENV === 'test') {
    return Array.from(results.values()).sort((a, b) => a.path.localeCompare(b.path));
  }

  // 4. Common user directories
  const home = os.homedir();
  if (home) {
    const commonDirs = ['Desktop', 'Downloads', 'Documents', 'Projects', 'toad', 'dev', 'workspace', 'repos', 'code', 'designs']
      .map(sub => path.join(home, sub))
      .filter(p => fs.existsSync(p));

    for (const dir of commonDirs) {
      collectToadFiles(dir, results, seenDirs, 4, 0);
    }
  }

  // 5. System drives: root candidates and top-level directories
  const drives = getSystemDrives();
  const rootCandidates = ['toad', 'projects', 'dev', 'workspace', 'coding', 'designs', 'toad-projects', 'toad-designs', 'source', 'repos', 'code'];

  for (const drive of drives) {
    for (const candidate of rootCandidates) {
      const candidatePath = path.join(drive, candidate);
      if (fs.existsSync(candidatePath) && !isIgnoredPath(candidatePath)) {
        collectToadFiles(candidatePath, results, seenDirs, 4, 0);
      }
    }

    try {
      const entries = fs.readdirSync(drive, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const lower = entry.name.toLowerCase();
        const full = path.join(drive, entry.name);
        if (isIgnoredPath(full) || isIgnoredPath(lower) || lower.startsWith('$') || lower.startsWith('.')) {
          continue;
        }
        collectToadFiles(full, results, seenDirs, 3, 0);
      }
    } catch {}
  }

  // Save all discovered files to cache for instant subsequent lookups
  if (results.size > 0) {
    saveCache(Array.from(results.values()).map(r => r.path));
  }

  return Array.from(results.values()).sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Interactive selection when multiple files are found, or automatic return if single match.
 */
export async function resolveEntryFile(
  query: string | undefined
): Promise<string | null> {
  // If no query was given, check cwd for .toad files
  if (!query) {
    let cwdFiles: string[] = [];
    try {
      cwdFiles = fs.readdirSync(process.cwd())
        .filter(f => f.toLowerCase().endsWith('.toad'))
        .map(f => path.resolve(f));
    } catch {}

    if (cwdFiles.length === 1) {
      console.log(`[toad] Verwende Datei im aktuellen Verzeichnis: ${cwdFiles[0]}`);
      return cwdFiles[0];
    } else if (cwdFiles.length > 1) {
      return promptUserSelection(cwdFiles, 'im aktuellen Verzeichnis');
    } else {
      console.error(`[toad error] Keine .toad-Datei im aktuellen Verzeichnis gefunden.`);
      console.log(`Tipp: Verwende 'toad <dateiname>' (z. B. 'toad logo') um systemweit zu suchen.`);
      return null;
    }
  }

  try {
    console.log(`[toad] Suche nach "${query}"...`);
    const matches = await findToadFiles(query);

    if (matches.length === 0) {
      console.error(`\n[toad error] Entry file not found. Keine Datei mit dem Namen "${query}" auf der Festplatte gefunden.\n`);
      return null;
    }

    if (matches.length === 1) {
      console.log(`[toad] Gefunden: ${matches[0]}`);
      return matches[0];
    }

    return promptUserSelection(matches, `für "${query}"`);
  } catch (err: any) {
    console.error(`[toad error] ${err.message || String(err)}`);
    return null;
  }
}

/**
 * Renders interactive selection list for multiple matches.
 */
function promptUserSelection(matches: string[], contextLabel: string): Promise<string | null> {
  if (!process.stdin.isTTY) {
    console.log(`\n[toad] Multiple files ${contextLabel} found in non-interactive environment. Using closest match: ${matches[0]}`);
    return Promise.resolve(matches[0] || null);
  }
  return new Promise((resolve) => {
    console.log(`\n[toad] Mehrere Dateien ${contextLabel} gefunden:\n`);
    matches.forEach((m, idx) => {
      console.log(`  ${c.bold(c.cyan(`[${idx + 1}]`))} ${m}`);
    });

    console.log('');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`Bitte wähle eine Datei [1-${matches.length}] (oder 'q' zum Abbrechen): `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === 'q' || trimmed === 'exit') {
        console.log('[toad] Vorgang abgebrochen.');
        resolve(null);
        return;
      }

      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= matches.length) {
        const selected = matches[num - 1];
        console.log(`[toad] Ausgewählt: ${selected}`);
        resolve(selected);
      } else {
        console.log(c.yellow('[toad] Ungültige Auswahl. Abgebrochen.'));
        resolve(null);
      }
    });
  });
}
