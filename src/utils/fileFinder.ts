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

      // Skip ignored and hidden directories
      if (IGNORED_FOLDERS.has(lower) || lower.startsWith('$') || lower.startsWith('.')) {
        continue;
      }

      const fullPath = path.join(dir, name);

      if (entry.isFile()) {
        const lowerNoExt = lower.endsWith('.toad') ? lower.slice(0, -5) : lower;
        const targetNoExt = targetFileName.endsWith('.toad') ? targetFileName.slice(0, -5) : targetFileName;

        const isExactMatch =
          lower === targetFileName ||
          lower === targetFileName + '.toad' ||
          (targetFileName.endsWith('.toad') && lower === targetFileName);

        // Normalize hyphens and underscores (e.g. vario_nova matches vario-nova)
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
    const drives: string[] = [];
    for (let i = 65; i <= 90; i++) {
      const drive = String.fromCharCode(i) + ':\\';
      try {
        if (fs.existsSync(drive)) {
          drives.push(drive);
        }
      } catch {}
    }
    return drives;
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
