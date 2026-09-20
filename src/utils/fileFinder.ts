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
  'recovery', 'msys64', 'inetpub', 'intel', 'programme', 'application data'
]);

// Configuration file for user settings and workspaces
const CONFIG_FILE = path.join(os.homedir(), '.toadrc.json');

export interface ToadConfig {
  searchPaths?: string[]; // Folders searched first during file searches
  workspaces?: string[];  // Alias for searchPaths
  searchIgnoreDirs?: string[]; // Custom directory names/patterns to skip during file searches
  searchTimeoutMs?: number; // Maximum search duration in milliseconds before early abort
  defaultOutputDir?: string; // Default output folder for exports (empty = beside input file)
  outputNamingPattern?: string; // Custom naming pattern with variables, e.g. "{name}{scale}"
  overwriteExisting?: boolean; // Overwrite existing files or generate numbered suffixes
  defaultFps?: number; // Default framerate for motion exports (e.g. 30, 60, 120)
  defaultMotionFormat?: string; // Default format for motion (mp4, webm, gif, frames)
  defaultFormat?: string; // e.g. 'png' | 'webp' | 'jpg' | 'svg'
  defaultQuality?: number; // 1-100 (default: 90)
  defaultScale?: number; // e.g. 1, 2, 4
  aiDevice?: 'auto' | 'dml' | 'cpu' | string;
  autoUpdate?: boolean;
  theme?: string;
  [key: string]: any;
}

export const DEFAULT_CONFIG: ToadConfig = {
  searchPaths: [],
  workspaces: [],
  searchIgnoreDirs: [],
  searchTimeoutMs: 5000,
  defaultOutputDir: '',
  outputNamingPattern: '{name}{suffix}{scale}',
  overwriteExisting: true,
  defaultFps: 60,
  defaultMotionFormat: 'mp4',
  defaultFormat: 'png',
  defaultQuality: 90,
  defaultScale: 1,
  aiDevice: 'auto',
  autoUpdate: true,
  theme: 'dark'
};

/**
 * Checks if a given path or directory name should be skipped.
 * Explicitly ignores OS system folders, \toad\tests\, \toad\the_seed\,
 * and user-configured searchIgnoreDirs.
 */
export function isIgnoredPath(targetPath: string, customIgnoreDirs?: string[]): boolean {
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

  // Check against custom user ignore dirs
  const userIgnores = customIgnoreDirs || getConfig().searchIgnoreDirs || [];
  if (userIgnores.length > 0) {
    for (const pattern of userIgnores) {
      const p = pattern.trim().toLowerCase().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      if (!p) continue;
      if (segments.includes(p) || normalized.includes('/' + p + '/') || normalized.endsWith('/' + p) || normalized === p) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Formats an output filename according to the user-configured pattern or default template.
 * Supported variables:
 *  - {name}    : Basename of the file (e.g. "poster")
 *  - {ext}     : Extension without dot (e.g. "png")
 *  - {suffix}  : Canvas/Page suffix (e.g. "-page2")
 *  - {scale}   : Scale indicator (e.g. "@2x" or empty)
 *  - {width}   : Canvas width in pixels
 *  - {height}  : Canvas height in pixels
 *  - {dpi}     : Effective DPI
 *  - {format}  : Output format (e.g. "png")
 *  - {date}    : Current ISO date (YYYY-MM-DD)
 *  - {time}    : Current timestamp (HH-MM-SS)
 *  - {page}    : Page/canvas index (1-based)
 */
export function formatOutputFileName(
  pattern: string | undefined,
  vars: {
    name: string;
    ext?: string;
    suffix?: string;
    scale?: string | number;
    width?: number;
    height?: number;
    dpi?: number;
    format?: string;
    page?: number;
  }
): string {
  const tmpl = pattern && pattern.trim() ? pattern : '{name}{suffix}{scale}';
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('-');

  // Random character generation: {rand} = single char, {rand4} = 4 chars
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const getRandomChars = (len = 1) => {
    let s = '';
    for (let i = 0; i < len; i++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return s;
  };
  const rand1 = getRandomChars(1);
  const rand4 = getRandomChars(4);

  let scaleStr = '';
  if (vars.scale !== undefined && vars.scale !== '' && vars.scale !== 1) {
    if (typeof vars.scale === 'number') {
      scaleStr = `@${vars.scale}x`;
    } else {
      scaleStr = String(vars.scale);
    }
  }

  const map: Record<string, string> = {
    '{name}': vars.name || 'output',
    '{ext}': vars.ext || vars.format || 'png',
    '{suffix}': vars.suffix || '',
    '{scale}': scaleStr,
    '{width}': vars.width !== undefined ? String(vars.width) : '',
    '{height}': vars.height !== undefined ? String(vars.height) : '',
    '{dpi}': vars.dpi !== undefined ? String(vars.dpi) : '',
    '{format}': vars.format || vars.ext || 'png',
    '{page}': vars.page !== undefined ? String(vars.page) : '1',
    '{date}': dateStr,
    '{time}': timeStr,
    '{datum}': dateStr,
    '{uhrzeit}': timeStr,
    '{rand}': rand1,
    '{rand4}': rand4,
    '{random}': rand4,
    '{zufall}': rand1
  };

  let res = tmpl;
  for (const [placeholder, val] of Object.entries(map)) {
    res = res.split(placeholder).join(val);
  }

  // Clean up duplicate separators or invalid filesystem characters
  return res.replace(/[/\\:*?"<>|]/g, '-').replace(/-+/g, '-').replace(/^[-_]+|[-_]+$/g, '') || vars.name;
}

/**
 * Resolves the destination output file path, taking into account defaultOutputDir,
 * outputNamingPattern, and overwriteExisting (numbering -1, -2 if overwrite is false).
 */
export function resolveOutputDestination(
  inputEntry: string,
  cliOutDir: string | undefined,
  format: string,
  vars: {
    name: string;
    suffix?: string;
    scale?: string | number;
    width?: number;
    height?: number;
    dpi?: number;
    page?: number;
  }
): string {
  const cfg = getConfig();
  let baseDir = cliOutDir ? path.resolve(cliOutDir) : '';
  if (!baseDir) {
    if (cfg.defaultOutputDir && cfg.defaultOutputDir.trim()) {
      baseDir = path.isAbsolute(cfg.defaultOutputDir)
        ? cfg.defaultOutputDir
        : path.resolve(process.cwd(), cfg.defaultOutputDir);
    } else {
      baseDir = path.dirname(path.resolve(inputEntry));
    }
  }

  const baseFileName = formatOutputFileName(cfg.outputNamingPattern, {
    ...vars,
    format,
    ext: format
  });

  const extWithDot = `.${format.toLowerCase()}`;
  let finalPath = path.join(baseDir, `${baseFileName}${extWithDot}`);

  const overwrite = cfg.overwriteExisting !== false;
  if (!overwrite && fs.existsSync(finalPath)) {
    let counter = 1;
    while (fs.existsSync(path.join(baseDir, `${baseFileName}-${counter}${extWithDot}`))) {
      counter++;
    }
    finalPath = path.join(baseDir, `${baseFileName}-${counter}${extWithDot}`);
  }

  return finalPath;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getConfig(): ToadConfig {
  let loaded: ToadConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      loaded = JSON.parse(raw) || {};
    }
  } catch {}

  const rawPaths = Array.isArray(loaded.searchPaths)
    ? loaded.searchPaths
    : (Array.isArray(loaded.workspaces) ? loaded.workspaces : []);

  return {
    ...DEFAULT_CONFIG,
    ...loaded,
    searchPaths: rawPaths,
    workspaces: rawPaths
  };
}

export function saveConfig(updates: Partial<ToadConfig>): ToadConfig {
  let current: ToadConfig = {};
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      current = JSON.parse(raw) || {};
    }
  } catch {}

  const merged = { ...current, ...updates };
  Object.keys(merged).forEach(k => {
    if (merged[k] === undefined) delete merged[k];
  });

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err: any) {
    console.error(`Failed to write configuration to ${CONFIG_FILE}:`, err);
  }
  return getConfig();
}

export function getConfigValue(key: string): any {
  const cfg = getConfig();
  return cfg[key];
}

export function setConfigValue(key: string, rawVal: any): { success: boolean; message: string; key: string; value: any; config: ToadConfig } {
  let parsedVal = rawVal;
  if (typeof rawVal === 'string') {
    const trimmed = rawVal.trim();
    if (trimmed.toLowerCase() === 'true') parsedVal = true;
    else if (trimmed.toLowerCase() === 'false') parsedVal = false;
    else if (/^-?\d+(\.\d+)?$/.test(trimmed)) parsedVal = Number(trimmed);
    else {
      try {
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          parsedVal = JSON.parse(trimmed);
        }
      } catch {}
    }
  }

  // Value validations
  if (key === 'defaultQuality') {
    const n = Number(parsedVal);
    if (isNaN(n) || n < 1 || n > 100) {
      return { success: false, message: `Quality must be a number between 1 and 100 (got ${rawVal})`, key, value: rawVal, config: getConfig() };
    }
    parsedVal = Math.round(n);
  }
  if (key === 'defaultScale') {
    const n = Number(parsedVal);
    if (isNaN(n) || n <= 0 || n > 16) {
      return { success: false, message: `Scale must be a positive number between 1 and 16 (got ${rawVal})`, key, value: rawVal, config: getConfig() };
    }
    parsedVal = n;
  }
  if (key === 'defaultFormat') {
    const valid = ['png', 'webp', 'jpg', 'jpeg', 'svg', 'psd', 'pdf', 'avif'];
    if (!valid.includes(String(parsedVal).toLowerCase())) {
      return { success: false, message: `Format must be one of: ${valid.join(', ')} (got ${rawVal})`, key, value: rawVal, config: getConfig() };
    }
    parsedVal = String(parsedVal).toLowerCase();
  }
  if (key === 'aiDevice') {
    const valid = ['auto', 'dml', 'cpu'];
    if (!valid.includes(String(parsedVal).toLowerCase())) {
      return { success: false, message: `aiDevice must be one of: ${valid.join(', ')} (got ${rawVal})`, key, value: rawVal, config: getConfig() };
    }
    parsedVal = String(parsedVal).toLowerCase();
  }
  if (key === 'searchTimeoutMs') {
    const n = Number(parsedVal);
    if (isNaN(n) || n < 500 || n > 120000) {
      return { success: false, message: `searchTimeoutMs must be a number between 500 and 120000 ms (got ${rawVal})`, key, value: rawVal, config: getConfig() };
    }
    parsedVal = Math.round(n);
  }
  if (key === 'defaultFps') {
    const n = Number(parsedVal);
    if (isNaN(n) || n < 1 || n > 240) {
      return { success: false, message: `defaultFps must be between 1 and 240 (got ${rawVal})`, key, value: rawVal, config: getConfig() };
    }
    parsedVal = Math.round(n);
  }
  if (key === 'defaultMotionFormat') {
    const valid = ['mp4', 'webm', 'gif', 'frames'];
    if (!valid.includes(String(parsedVal).toLowerCase())) {
      return { success: false, message: `defaultMotionFormat must be one of: ${valid.join(', ')} (got ${rawVal})`, key, value: rawVal, config: getConfig() };
    }
    parsedVal = String(parsedVal).toLowerCase();
  }
  if (key === 'searchIgnoreDirs') {
    if (typeof parsedVal === 'string') {
      parsedVal = parsedVal.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    } else if (!Array.isArray(parsedVal)) {
      parsedVal = [];
    }
  }
  if (key === 'outputNamingPattern') {
    parsedVal = String(parsedVal || '{name}{suffix}{scale}').trim();
  }
  if (key === 'defaultOutputDir') {
    parsedVal = String(parsedVal || '').trim();
  }
  if (key === 'overwriteExisting') {
    parsedVal = Boolean(parsedVal);
  }

  const updated = saveConfig({ [key]: parsedVal });
  return {
    success: true,
    message: `Configuration updated: ${key} = ${JSON.stringify(parsedVal)}`,
    key,
    value: parsedVal,
    config: updated
  };
}

export function resetConfig(): ToadConfig {
  const current = getConfig();
  const resetData: ToadConfig = {
    ...DEFAULT_CONFIG,
    searchPaths: current.searchPaths || current.workspaces || [],
    workspaces: current.searchPaths || current.workspaces || []
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(resetData, null, 2), 'utf-8');
  return resetData;
}

export function getSearchPaths(): string[] {
  const cfg = getConfig();
  const list = Array.isArray(cfg.searchPaths) ? cfg.searchPaths : (Array.isArray(cfg.workspaces) ? cfg.workspaces : []);
  return list.filter(dir => {
    try {
      return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });
}

export function addSearchPath(dirPath: string): { success: boolean; message: string; searchPaths: string[] } {
  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    return { success: false, message: `Directory does not exist: ${resolved}`, searchPaths: getSearchPaths() };
  }

  const current = getSearchPaths();
  const normalizedNew = resolved.toLowerCase();
  if (current.some(w => path.resolve(w).toLowerCase() === normalizedNew)) {
    return { success: true, message: `Priority search path is already registered: ${resolved}`, searchPaths: current };
  }

  current.push(resolved);
  saveConfig({ searchPaths: current, workspaces: current });
  return { success: true, message: `Priority search path added: ${resolved}`, searchPaths: current };
}

export function removeSearchPath(dirPath: string): { success: boolean; message: string; searchPaths: string[] } {
  const resolved = path.resolve(dirPath);
  const current = getSearchPaths();
  const normalized = resolved.toLowerCase();
  const filtered = current.filter(w => path.resolve(w).toLowerCase() !== normalized);

  if (filtered.length === current.length) {
    return { success: false, message: `Search path not found: ${dirPath}`, searchPaths: current };
  }

  saveConfig({ searchPaths: filtered, workspaces: filtered });
  return { success: true, message: `Priority search path removed: ${resolved}`, searchPaths: filtered };
}

export function setSearchPaths(dirs: string[]): { success: boolean; message: string; searchPaths: string[] } {
  const valid: string[] = [];
  const seen = new Set<string>();

  for (const d of dirs) {
    if (typeof d !== 'string' || !d.trim()) continue;
    const resolved = path.resolve(d.trim());
    const norm = resolved.toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        valid.push(resolved);
      }
    }
  }

  saveConfig({ searchPaths: valid, workspaces: valid });
  return { success: true, message: 'Priority search paths reordered successfully', searchPaths: valid };
}

export const setWorkspaces = setSearchPaths;

export const getWorkspaces = getSearchPaths;
export function addWorkspace(dirPath: string): { success: boolean; message: string; workspaces: string[] } {
  const res = addSearchPath(dirPath);
  return { success: res.success, message: res.message, workspaces: res.searchPaths };
}
export function removeWorkspace(dirPath: string): { success: boolean; message: string; workspaces: string[] } {
  const res = removeSearchPath(dirPath);
  return { success: res.success, message: res.message, workspaces: res.searchPaths };
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
 * Searches directories breadth-first for matching files (.toad or any extension).
 */
function searchDir(
  dir: string,
  targetFileName: string,
  results: string[],
  seenPaths: Set<string>,
  maxDepth = 5,
  currentDepth = 0,
  seenDirs = new Set<string>(),
  targetExtensions?: string[],
  deadline?: number
): void {
  if (currentDepth > maxDepth || results.length >= 25) return;
  if (deadline !== undefined && Date.now() > deadline) return;

  try {
    let canonicalDir = dir;
    try {
      canonicalDir = fs.realpathSync(dir).toLowerCase();
    } catch {
      canonicalDir = path.resolve(dir).toLowerCase();
    }
    if (seenDirs.has(canonicalDir)) return;
    seenDirs.add(canonicalDir);

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const subdirs: string[] = [];

    const allowedExts = targetExtensions ? targetExtensions.map(e => e.toLowerCase()) : null;

    for (const entry of entries) {
      if (deadline !== undefined && Date.now() > deadline) return;
      const name = entry.name;
      const lower = name.toLowerCase();

      const fullPath = path.join(dir, name);

      // Skip ignored and hidden directories
      if (isIgnoredPath(fullPath) || isIgnoredPath(name) || lower.startsWith('$') || lower.startsWith('.')) {
        continue;
      }

      let isFile = entry.isFile();
      let isDir = entry.isDirectory();

      if (entry.isSymbolicLink()) {
        try {
          const stat = fs.statSync(fullPath);
          isFile = stat.isFile();
          isDir = stat.isDirectory();
        } catch {
          continue;
        }
      }

      if (isFile) {
        let isMatch = false;

        if (allowedExts && allowedExts.length > 0) {
          const entryExt = path.extname(lower);
          if (allowedExts.includes(entryExt)) {
            // Check exact filename match
            if (lower === targetFileName) {
              isMatch = true;
            } else {
              const entryBase = path.basename(lower, entryExt);
              const targetExt = path.extname(targetFileName);
              const targetBase = targetExt ? path.basename(targetFileName, targetExt) : targetFileName;

              // Exact stem match or fuzzy hyphen/underscore match
              if (entryBase === targetBase || entryBase.replace(/[-_]/g, '') === targetBase.replace(/[-_]/g, '')) {
                isMatch = true;
              }
            }
          }
        } else {
          // Default .toad matching mode
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

          isMatch = isExactMatch || isFuzzyHyphenMatch;
        }

        if (isMatch) {
          const resolved = path.resolve(fullPath);
          const normalized = resolved.toLowerCase();
          if (!seenPaths.has(normalized)) {
            seenPaths.add(normalized);
            results.push(resolved);
          }
        }
      } else if (isDir) {
        if (!isIgnoredPath(fullPath) && !IGNORED_FOLDERS.has(lower)) {
          try {
            const realSub = fs.realpathSync(fullPath).toLowerCase();
            if (!seenDirs.has(realSub)) {
              subdirs.push(fullPath);
            }
          } catch {
            // Ignore broken symlinks or unreadable paths
          }
        }
      }
    }

    for (const sub of subdirs) {
      if (results.length >= 25) break;
      if (deadline !== undefined && Date.now() > deadline) break;
      searchDir(sub, targetFileName, results, seenPaths, maxDepth, currentDepth + 1, seenDirs, targetExtensions, deadline);
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
  const cfg = getConfig();
  const deadline = Date.now() + (cfg.searchTimeoutMs || 5000);

  // 1.5 Priority Search Paths (Configured in settings - searched first)
  const priorityPaths = getSearchPaths();
  for (const pDir of priorityPaths) {
    if (fs.existsSync(pDir) && !seenPaths.has(pDir.toLowerCase())) {
      searchDir(pDir, targetBase, results, seenPaths, 5, 0, new Set<string>(), undefined, deadline);
      if (results.length > 0) {
        saveCache(results);
        return results;
      }
    }
  }

  // 2. Fast Tier 1: Search current working directory (depth 5)
  if (!seenPaths.has(process.cwd().toLowerCase())) {
    searchDir(process.cwd(), targetBase, results, seenPaths, 5, 0, new Set<string>(), undefined, deadline);
    if (results.length > 0) {
      saveCache(results);
      return results;
    }
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
    const commonDirs = ['Desktop', 'Downloads', 'Documents', 'Pictures', 'Bilder', 'Projects', 'toad', 'dev', 'workspace']
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
        if (IGNORED_FOLDERS.has(lower) || lower === 'users' || lower === 'dokumente und einstellungen' || lower.startsWith('$') || lower.startsWith('.')) {
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
 * Finds all matching files with specified extensions across cwd, workspaces, user directories, and system drives.
 */
export async function findAnyFile(query: string, options?: { extensions?: string[] }): Promise<string[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const allowedExts = options?.extensions && options.extensions.length > 0
    ? options.extensions.map(e => e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`)
    : undefined;

  // 1. Direct path check (instant)
  const resolvedDirect = path.resolve(query);
  if (fs.existsSync(resolvedDirect)) {
    if (fs.statSync(resolvedDirect).isDirectory()) {
      return [];
    }
    return [resolvedDirect];
  }

  // If extensions provided and query has no extension, try direct with each extension
  if (allowedExts && !path.extname(query)) {
    for (const ext of allowedExts) {
      const withExt = path.resolve(query + ext);
      if (fs.existsSync(withExt) && !fs.statSync(withExt).isDirectory()) {
        return [withExt];
      }
    }
  }

  const results: string[] = [];
  const seenPaths = new Set<string>();
  const cfg = getConfig();
  const deadline = Date.now() + (cfg.searchTimeoutMs || 5000);

  // 1.5 Priority Search Paths (Configured in settings - searched first)
  const priorityPaths = getSearchPaths();
  for (const pDir of priorityPaths) {
    if (fs.existsSync(pDir) && !seenPaths.has(pDir.toLowerCase())) {
      searchDir(pDir, normalizedQuery, results, seenPaths, 5, 0, new Set<string>(), allowedExts, deadline);
      if (results.length > 0) {
        return results;
      }
    }
  }

  // 2. Fast Tier 1: Search current working directory (depth 5)
  if (!seenPaths.has(process.cwd().toLowerCase())) {
    searchDir(process.cwd(), normalizedQuery, results, seenPaths, 5, 0, new Set<string>(), allowedExts, deadline);
    if (results.length > 0) {
      return results;
    }
  }

  // In test or CI environments, do not traverse external directories unless explicitly allowed
  if (process.env.VITEST || process.env.CI || process.env.NODE_ENV === 'test') {
    return results;
  }

  // 3. Preferred Workspaces (Highest priority outside CWD)
  const configuredWorkspaces = getWorkspaces();
  for (const ws of configuredWorkspaces) {
    if (!seenPaths.has(ws.toLowerCase())) {
      searchDir(ws, normalizedQuery, results, seenPaths, 5, 0, new Set<string>(), allowedExts, deadline);
      if (results.length > 0) {
        return results;
      }
    }
  }

  // 4. Fast Tier 3: Search common user directories (depth 4)
  const home = os.homedir();
  if (home) {
    const commonDirs = ['Desktop', 'Downloads', 'Documents', 'Pictures', 'Bilder', 'Projects', 'toad', 'dev', 'workspace']
      .map(sub => path.join(home, sub))
      .filter(p => fs.existsSync(p));

    for (const dir of commonDirs) {
      if (!seenPaths.has(dir.toLowerCase())) {
        searchDir(dir, normalizedQuery, results, seenPaths, 4, 0, new Set<string>(), allowedExts, deadline);
        if (results.length > 0) {
          return results;
        }
      }
    }
  }

  // 5. Fast Tier 4: Search root drive project folders
  const drives = getSystemDrives();
  const rootCandidates = ['toad', 'projects', 'dev', 'workspace', 'coding', 'designs', 'toad-projects', 'images', 'assets', 'bilder'];

  for (const drive of drives) {
    for (const candidate of rootCandidates) {
      const candidatePath = path.join(drive, candidate);
      if (fs.existsSync(candidatePath) && !seenPaths.has(candidatePath.toLowerCase())) {
        searchDir(candidatePath, normalizedQuery, results, seenPaths, 4, 0, new Set<string>(), allowedExts, deadline);
        if (results.length > 0) {
          return results;
        }
      }
    }
  }

  // 6. Fast Tier 5: Scan top-level folders on system drives
  for (const drive of drives) {
    try {
      const entries = fs.readdirSync(drive, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const lower = entry.name.toLowerCase();
        if (IGNORED_FOLDERS.has(lower) || lower === 'users' || lower === 'dokumente und einstellungen' || lower.startsWith('$') || lower.startsWith('.')) {
          continue;
        }
        const full = path.join(drive, entry.name);
        if (!seenPaths.has(full.toLowerCase())) {
          searchDir(full, normalizedQuery, results, seenPaths, 3, 0, new Set<string>(), allowedExts, deadline);
          if (results.length > 0) {
            return results;
          }
        }
      }
    } catch {}
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

      let isFile = entry.isFile();
      let isDir = entry.isDirectory();

      if (entry.isSymbolicLink()) {
        try {
          const stat = fs.statSync(fullPath);
          isFile = stat.isFile();
          isDir = stat.isDirectory();
        } catch {
          continue;
        }
      }

      if (isFile) {
        if (lower.endsWith('.toad') || lower.endsWith('.toadm')) {
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
      } else if (isDir) {
        if (!isIgnoredPath(fullPath) && !isIgnoredPath(lower)) {
          try {
            const realSub = fs.realpathSync(fullPath).toLowerCase();
            if (!seenDirs.has(realSub)) {
              subdirs.push(fullPath);
            }
          } catch {
            subdirs.push(fullPath);
          }
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

  // 1. Priority Search Paths (Configured in settings - searched first)
  const priorityPaths = getSearchPaths();
  for (const pDir of priorityPaths) {
    if (fs.existsSync(pDir) && !isIgnoredPath(pDir)) {
      collectToadFiles(pDir, results, seenDirs, 5, 0);
    }
  }

  // 2. Current working directory (depth 5)
  if (!isIgnoredPath(process.cwd()) && !seenDirs.has(process.cwd().toLowerCase())) {
    collectToadFiles(process.cwd(), results, seenDirs, 5, 0);
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
    const commonDirs = ['Desktop', 'Downloads', 'Documents', 'Pictures', 'Bilder', 'Projects', 'toad', 'dev', 'workspace', 'repos', 'code', 'designs']
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
        if (isIgnoredPath(full) || isIgnoredPath(lower) || lower === 'users' || lower === 'dokumente und einstellungen' || lower.startsWith('$') || lower.startsWith('.')) {
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
      console.log(`[toad] Using file in current directory: ${cwdFiles[0]}`);
      return cwdFiles[0];
    } else if (cwdFiles.length > 1) {
      return promptUserSelection(cwdFiles, 'in current directory');
    } else {
      console.error(`[toad error] No .toad file found in current directory.`);
      console.log(`Tip: Use 'toad <filename>' (e.g. 'toad logo') to search system-wide.`);
      return null;
    }
  }

  try {
    console.log(`[toad] Searching for "${query}"...`);
    const matches = await findToadFiles(query);

    if (matches.length === 0) {
      console.error(`\n[toad error] Entry file not found. No file named "${query}" found on disk.\n`);
      return null;
    }

    if (matches.length === 1) {
      console.log(`[toad] Found: ${matches[0]}`);
      return matches[0];
    }

    return promptUserSelection(matches, `for "${query}"`);
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
    console.log(`\n[toad] Multiple files ${contextLabel} found:\n`);
    matches.forEach((m, idx) => {
      console.log(`  ${c.bold(c.cyan(`[${idx + 1}]`))} ${m}`);
    });

    console.log('');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(`Please select a file [1-${matches.length}] (or 'q' to cancel): `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === 'q' || trimmed === 'exit') {
        console.log('[toad] Operation cancelled.');
        resolve(null);
        return;
      }

      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= matches.length) {
        const selected = matches[num - 1];
        console.log(`[toad] Selected: ${selected}`);
        resolve(selected);
      } else {
        console.log(c.yellow('[toad] Invalid selection. Cancelled.'));
        resolve(null);
      }
    });
  });
}

/**
 * Resolves any file (e.g. image, PSD, motion animation) by query or bare filename.
 * Searches cwd, workspaces, user directories (Downloads, Bilder, Desktop, etc.), and system drives.
 */
export async function resolveAnyFile(
  query: string | undefined,
  options?: { extensions?: string[]; description?: string }
): Promise<string | null> {
  if (!query || !query.trim()) {
    return null;
  }

  const desc = options?.description || 'file';

  // 1. Check direct path first
  const resolvedDirect = path.resolve(process.cwd(), query);
  if (fs.existsSync(resolvedDirect) && !fs.statSync(resolvedDirect).isDirectory()) {
    return resolvedDirect;
  }

  try {
    console.log(`[toad] Searching for "${query}"...`);
    const matches = await findAnyFile(query, { extensions: options?.extensions });

    if (matches.length === 0) {
      console.error(`\n[toad error] File not found. No ${desc} named "${query}" found on disk.\n`);
      return null;
    }

    if (matches.length === 1) {
      console.log(`[toad] Found: ${matches[0]}`);
      return matches[0];
    }

    return promptUserSelection(matches, `for "${query}"`);
  } catch (err: any) {
    console.error(`[toad error] ${err.message || String(err)}`);
    return null;
  }
}
