/**
 * src/engine/buildCache.ts
 * High-performance incremental compilation and text measurement cache.
 * Eliminates redundant Skia text layouts and AST parsing during watch mode and rebuilds.
 */

import * as crypto from 'node:crypto';
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
    return `${content}|${style.fontFamily || ''}|${style.fontSize || 16}|${style.fontWeight || ''}|${style.fontStyle || ''}|${style.lineHeight || ''}|${style.letterSpacing || 0}|${style.textTransform || ''}|${style.explicitWidth || ''}|${style.maxLines || ''}|${style.overflow || ''}|${style.trim || ''}`;
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
}

/**
 * Caches parsed DocumentNode ASTs keyed on file path and mtime/hash.
 */
export class AstCache {
  private static instance: AstCache;
  private cache = new Map<string, CachedFileEntry>();
  private hits = 0;
  private misses = 0;

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

    this.hits++;
    return entry.ast;
  }

  public set(filePath: string, mtimeMs: number, ast: DocumentNode, content?: string): void {
    const hash = content ? crypto.createHash('sha256').update(content).digest('hex') : '';
    this.cache.set(filePath, { mtimeMs, hash, ast });
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
