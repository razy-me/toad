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
      return { ...res, lines: [...res.lines] };
    }
    this.misses++;
    return undefined;
  }

  public set(key: string, value: TextLayoutResult): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest 20%
      const keysToDelete = Array.from(this.cache.keys()).slice(0, Math.floor(this.maxEntries * 0.2));
      for (const k of keysToDelete) {
        this.cache.delete(k);
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
    const entry = this.cache.get(filePath);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (currentMtimeMs !== undefined && entry.mtimeMs !== currentMtimeMs) {
      this.cache.delete(filePath);
      this.misses++;
      return null;
    }

    if (entry.dependencies && entry.dependencies.length > 0) {
      for (const dep of entry.dependencies) {
        try {
          if (!fs.existsSync(dep)) {
            // A declared dependency was removed from disk -> invalidate
            this.cache.delete(filePath);
            this.misses++;
            return null;
          }
          const depMtime = fs.statSync(dep).mtimeMs;
          const recordedMtime = entry.dependencyMtimes?.[dep];
          if (recordedMtime !== undefined ? depMtime > recordedMtime : depMtime > entry.mtimeMs) {
            this.cache.delete(filePath);
            this.misses++;
            return null;
          }
        } catch {
          this.cache.delete(filePath);
          this.misses++;
          return null;
        }
      }
    }

    this.hits++;
    // LRU: re-insert to position at end of Map (most recently used)
    this.cache.delete(filePath);
    this.cache.set(filePath, entry);
    return entry.ast;
  }

  public set(filePath: string, mtimeMs: number, ast: DocumentNode, content?: string, dependencies?: string[]): void {
    const hash = content ? crypto.createHash('sha256').update(content).digest('hex') : '';
    const dependencyMtimes: Record<string, number> = {};
    if (dependencies && dependencies.length > 0) {
      for (const dep of dependencies) {
        try {
          if (fs.existsSync(dep)) {
            dependencyMtimes[dep] = fs.statSync(dep).mtimeMs;
          }
        } catch {}
      }
    }
    if (this.cache.has(filePath)) {
      this.cache.delete(filePath);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(filePath, { mtimeMs, hash, ast, dependencies, dependencyMtimes });
  }

  public setDependencies(filePath: string, dependencies: string[]): void {
    const entry = this.cache.get(filePath);
    if (entry) {
      entry.dependencies = dependencies;
      entry.dependencyMtimes = {};
      for (const dep of dependencies) {
        try {
          if (fs.existsSync(dep)) {
            entry.dependencyMtimes[dep] = fs.statSync(dep).mtimeMs;
          }
        } catch {}
      }
    }
  }

  public invalidate(filePath: string): void {
    this.cache.delete(filePath);
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
