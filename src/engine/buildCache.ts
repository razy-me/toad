/**
 * src/engine/buildCache.ts
 * High-performance incremental compilation and text measurement cache.
 * Eliminates redundant Skia text layouts and AST parsing during watch mode and rebuilds.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import type { TextLayoutResult } from '../parser/math.js';
import type { DocumentNode } from '../parser/ast.js';

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
}

/**
 * Normalizes file paths for deterministic cache keys across platforms.
 * Replaces backslashes with forward slashes and standardizes Windows drive letters to uppercase.
 */
export function normalizeCachePath(filePath: string): string {
  if (!filePath) return filePath;
  const forward = filePath.replace(/\\/g, '/');
  return forward.replace(/^([a-zA-Z]):\//, (_, drive) => `${drive.toUpperCase()}:/`);
}

/**
 * Caches expensive Skia canvas text measurement runs and word wrap computations.
 */
export class TextMeasurementCache {
  private static instance: TextMeasurementCache;
  private cache = new Map<string, TextLayoutResult>();
  private maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 5000) {
    this.maxEntries = maxEntries;
  }

  public static getInstance(): TextMeasurementCache {
    if (!TextMeasurementCache.instance) {
      TextMeasurementCache.instance = new TextMeasurementCache();
    }
    return TextMeasurementCache.instance;
  }

  public static makeKey(content: string, style: Record<string, any>): string {
    const ff = style.fontFeatures ? JSON.stringify(style.fontFeatures) : '';
    const fv = style.fontVariation ? JSON.stringify(style.fontVariation) : '';
    return `${content}|${style.fontFamily || ''}|${style.fontSize || 16}|${style.fontWeight || ''}|${style.fontStyle || ''}|${style.lineHeight || ''}|${style.letterSpacing || 0}|${style.textTransform || ''}|${style.explicitWidth || ''}|${style.maxLines || ''}|${style.overflow || ''}|${style.trim || ''}|${ff}|${fv}`;
  }

  public get(key: string): TextLayoutResult | undefined {
    const res = this.cache.get(key);
    if (res) {
      this.hits++;
      // True LRU: refresh entry order on access
      this.cache.delete(key);
      this.cache.set(key, res);
      return { ...res, lines: [...res.lines] };
    }
    this.misses++;
    return undefined;
  }

  public set(key: string, value: TextLayoutResult): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest 20%
      const evictCount = Math.max(1, Math.floor(this.maxEntries * 0.2));
      const iter = this.cache.keys();
      for (let i = 0; i < evictCount; i++) {
        const next = iter.next();
        if (next.done) break;
        this.cache.delete(next.value);
      }
    }
    this.cache.set(key, { ...value, lines: [...value.lines] });
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  public getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.cache.size
    };
  }
}

export interface CachedFileEntry {
  mtimeMs: number;
  hash: string;
  ast: DocumentNode;
  dependencies?: string[];
  dependencyMtimes?: Record<string, number>;
}

/**
 * Caches parsed DocumentNode ASTs keyed on file path and mtime/hash.
 */
export class AstCache {
  private static instance: AstCache;
  public static readonly MAX_AST_ENTRIES = 500;
  private cache = new Map<string, CachedFileEntry>();
  private maxEntries: number = AstCache.MAX_AST_ENTRIES;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = AstCache.MAX_AST_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  public static getInstance(): AstCache {
    if (!AstCache.instance) {
      AstCache.instance = new AstCache();
    }
    return AstCache.instance;
  }

  public get(filePath: string, currentMtimeMs?: number): DocumentNode | null {
    const key = normalizeCachePath(filePath);
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (currentMtimeMs !== undefined && entry.mtimeMs !== currentMtimeMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    if (entry.dependencies && entry.dependencies.length > 0) {
      for (const dep of entry.dependencies) {
        try {
          if (!fs.existsSync(dep)) {
            // A declared dependency was removed from disk -> invalidate
            this.cache.delete(key);
            this.misses++;
            return null;
          }
          const depMtime = fs.statSync(dep).mtimeMs;
          const recordedMtime = entry.dependencyMtimes?.[dep];
          if (recordedMtime !== undefined ? depMtime > recordedMtime : depMtime > entry.mtimeMs) {
            this.cache.delete(key);
            this.misses++;
            return null;
          }
        } catch {
          this.cache.delete(key);
          this.misses++;
          return null;
        }
      }
    }

    this.hits++;
    // LRU: re-insert to position at end of Map (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.ast;
  }

  public set(filePath: string, mtimeMs: number, ast: DocumentNode, content?: string, dependencies?: string[]): void {
    const key = normalizeCachePath(filePath);
    const hash = content ? crypto.createHash('sha256').update(content).digest('hex') : '';
    const normalizedDeps = dependencies?.map(normalizeCachePath);
    const dependencyMtimes: Record<string, number> = {};
    if (normalizedDeps && normalizedDeps.length > 0) {
      for (const dep of normalizedDeps) {
        try {
          if (fs.existsSync(dep)) {
            dependencyMtimes[dep] = fs.statSync(dep).mtimeMs;
          }
        } catch {}
      }
    }
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { mtimeMs, hash, ast, dependencies: normalizedDeps, dependencyMtimes });
  }

  public setDependencies(filePath: string, dependencies: string[]): void {
    const key = normalizeCachePath(filePath);
    const entry = this.cache.get(key);
    if (entry) {
      const normalizedDeps = dependencies.map(normalizeCachePath);
      const newMtimes: Record<string, number> = {};
      for (const dep of normalizedDeps) {
        try {
          if (fs.existsSync(dep)) {
            newMtimes[dep] = fs.statSync(dep).mtimeMs;
          }
        } catch {}
      }
      entry.dependencies = normalizedDeps;
      entry.dependencyMtimes = newMtimes;
    }
  }

  public invalidate(filePath: string): void {
    const key = normalizeCachePath(filePath);
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  public getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.cache.size
    };
  }
}
