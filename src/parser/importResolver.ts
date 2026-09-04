/**
 * src/parser/importResolver.ts
 * Resolves @import directives, variable scopes, component parameter bindings,
 * and component body expansions into a canonical ResolvedDocumentNode.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  DocumentNode,
  CanvasDeclarationNode,
  FontDirectiveNode,
  ElementNode,
  TextElementNode,
  PropertyNode,
  ValueNode,
  VariableDeclarationNode,
  ComponentDeclarationNode,
  ComponentInstanceNode,
  ResolvedDocumentNode,
  ResolvedCanvasNode,
  ResolvedElementNode,
  ResolvedFont,
  ResolvedStroke,
  ResolvedFilter,
  ResolvedGradient,
  DimensionLiteralNode,
  NumberLiteralNode,
  ColorLiteralNode,
  LinearGradientNode,
  RadialGradientNode,
  FilterValueNode,
  StrokeValueNode,
  FontValueNode,
  PointsValueNode,
  CoordinateValueNode,
  RelationalPositionNode,
  ColorTransformNode
} from './ast.js';
import { parseToad } from './parser.js';
import { applyAlpha, lightenColor, darkenColor } from '../engine/drawUtils.js';
import { suggestProperty } from '../tools/diagnostics.js';

export class CircularImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircularImportError';
  }
}

export class CircularVariableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircularVariableError';
  }
}

export class ComponentRecursionLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComponentRecursionLimitError';
  }
}

export function convertDimensionToPx(value: number, unit?: string, dpi = 96): number {
  if (!unit || unit === 'px') return value;
  if (unit === 'in') return value * dpi;
  if (unit === 'mm') return value * (dpi / 25.4);
  if (unit === 'cm') return value * (dpi / 2.54);
  if (unit === 'pt') return value * (dpi / 72);
  // em/rem resolve against the documented 16px root font size.
  if (unit === 'em' || unit === 'rem') return value * 16;
  return value;
}

export function computeGcd(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || isNaN(a) || isNaN(b)) {
    return 1;
  }
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0 && !isNaN(y)) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x === 0 || isNaN(x) ? 1 : x;
}

export function computeAspectRatio(width: number, height: number): { w: number; h: number; gcd: number; str: string } {
  if (!width || !height || width <= 0 || height <= 0) {
    return { w: 1, h: 1, gcd: 1, str: '1:1' };
  }
  const gcd = computeGcd(width, height);
  const w = Math.round(width) / gcd;
  const h = Math.round(height) / gcd;
  return { w, h, gcd, str: `${w}:${h}` };
}

export interface ImportResolverOptions {
  fileLoader?: (filePath: string) => string;
  maxComponentDepth?: number;
}

export async function resolveImportsAndComponents(
  entryDoc: DocumentNode,
  entryPath: string,
  fileLoader?: (p: string) => string
): Promise<ResolvedDocumentNode> {
  const resolver = new ImportResolver(entryDoc, entryPath, { fileLoader });
  return resolver.resolve();
}

export class ImportResolver {
  private entryDoc: DocumentNode;
  private entryPath: string;
  private fileLoader: (filePath: string) => string;
  private maxComponentDepth: number;
  private loadedDocs = new Map<string, DocumentNode>();
  private activeImportStack = new Set<string>();
  private instanceCounter = 0;
  private defaultFontFamily?: string;
  public warnings: string[] = [];

  constructor(entryDoc: DocumentNode, entryPath: string, options: ImportResolverOptions = {}) {
    this.entryDoc = entryDoc;
    this.entryPath = path.resolve(entryPath);
    this.fileLoader = options.fileLoader || ((p: string) => fs.readFileSync(p, 'utf-8'));
    this.maxComponentDepth = options.maxComponentDepth || 32;
  }

  public async resolve(): Promise<ResolvedDocumentNode> {
    this.loadedDocs.set(this.entryPath, this.entryDoc);

    // 1. Traverse and load all imports recursively
    const rawAllDocs = this.loadImportsRecursive(this.entryDoc, this.entryPath, [this.entryPath]);
    const allDocs: DocumentNode[] = [];
    const seenPaths = new Set<string>();
    for (const d of rawAllDocs) {
      const p = d.loc?.file ? (process.platform === 'win32' ? d.loc.file.toLowerCase() : d.loc.file) : '';
      if (!p || !seenPaths.has(p)) {
        if (p) seenPaths.add(p);
        allDocs.push(d);
      }
    }

    // 2. Aggregate font directives
    const fontDirectives: FontDirectiveNode[] = [];
    const seenFonts = new Set<string>();
    for (const doc of allDocs) {
      for (const dir of doc.directives) {
        if (dir.type === 'FontDirective') {
          const key = `${dir.family}-${dir.weight || 'normal'}-${dir.style || 'normal'}`;
          if (!seenFonts.has(key)) {
            seenFonts.add(key);
            fontDirectives.push(dir);
          }
        }
      }
    }

    // 3. Aggregate component declarations
    const components = new Map<string, ComponentDeclarationNode>();
    for (const doc of allDocs) {
      for (const comp of doc.components) {
        components.set(comp.name, comp);
      }
    }

    // 4. Aggregate global variables with shadowing (later docs override earlier)
    const rawVariables = new Map<string, ValueNode>();

    const flattenVariables = (prefix: string, value: ValueNode) => {
      rawVariables.set(prefix, value);
      if (value.type === 'ObjectLiteral') {
        const obj = value as any; // ObjectLiteralNode
        for (const [key, val] of Object.entries(obj.properties)) {
          const nestedPrefix = prefix ? `${prefix}.${key}` : key;
          flattenVariables(nestedPrefix, val as ValueNode);
        }
      }
    };

    for (const doc of allDocs) {
      for (const v of doc.variables) {
        flattenVariables(v.name, v.value);
      }
    }

    // 5. Resolve variable values (substitute nested variable references)
    const resolvedVariables = this.resolveAllVariables(rawVariables);

    // 5b. Determine document default font-family from canvas or @font directives
    let canvasFontFamily: string | undefined;
    const canvasProps = this.entryDoc.canvas?.properties || this.entryDoc.canvases?.[0]?.properties;
    if (canvasProps) {
      for (const p of canvasProps) {
        if (p.name === 'font-family' || p.name === 'fontFamily' || p.name === 'font') {
          const v = this.substituteVariablesInValue(p.value, n => resolvedVariables.get(n));
          canvasFontFamily = this.extractString(v);
        }
      }
    }
    this.defaultFontFamily = canvasFontFamily || (fontDirectives.length > 0 ? fontDirectives[0].family : undefined);

    // 6. Expand components and substitute variables in top-level elements
    const resolvedElements: ResolvedElementNode[] = [];
    for (const elem of this.entryDoc.elements) {
      const expanded = this.expandElement(elem, components, resolvedVariables, 0);
      if (Array.isArray(expanded)) {
        resolvedElements.push(...expanded);
      } else if (expanded) {
        resolvedElements.push(expanded);
      }
    }

    // 7. Resolve Canvases (single or multiple)
    const rawCanvases = this.entryDoc.canvases && this.entryDoc.canvases.length > 0
      ? this.entryDoc.canvases
      : (this.entryDoc.canvas ? [this.entryDoc.canvas] : []);

    const resolvedCanvases: ResolvedCanvasNode[] = [];
    if (rawCanvases.length > 0) {
      for (const cNode of rawCanvases) {
        resolvedCanvases.push(this.resolveSingleCanvas(cNode, resolvedVariables, components));
      }
    } else {
      resolvedCanvases.push(this.resolveSingleCanvas(undefined, resolvedVariables, components));
    }

    const primaryCanvas = resolvedCanvases[0];
    if (!primaryCanvas.elements || primaryCanvas.elements.length === 0) {
      primaryCanvas.elements = resolvedElements;
    }
    const finalDocElements = resolvedElements.length > 0 ? resolvedElements : (primaryCanvas.elements || []);

    const dependencies = Array.from(this.loadedDocs.keys());

    return {
      canvas: primaryCanvas,
      canvases: resolvedCanvases.length > 1 ? resolvedCanvases : undefined,
      fonts: fontDirectives,
      elements: finalDocElements,
      filePath: this.entryPath,
      dependencies,
      warnings: this.warnings
    };
  }

  // ==========================================================================
  // Imports Loading
  // ==========================================================================

  private loadImportsRecursive(doc: DocumentNode, currentFilePath: string, chain: string[], visited = new Set<string>()): DocumentNode[] {
    const docs: DocumentNode[] = [];
    const currentDir = path.dirname(currentFilePath);

    for (const dir of doc.directives) {
      if (dir.type === 'ImportDirective') {
        let importPath = dir.path;
        if (!path.extname(importPath)) {
          importPath += '.toad';
        }
        const resolvedPath = path.resolve(currentDir, importPath);
        const canonPath = process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;

        if (chain.some(p => (process.platform === 'win32' ? p.toLowerCase() : p) === canonPath)) {
          // Direct two-file mutual imports (entry <-> A) are tolerated by
          // skipping the re-import; deeper cycles throw so users get a clear
          // diagnostic instead of infinite recursion.
          if (chain.length < 3 && resolvedPath !== currentFilePath) {
            continue;
          }
          const cycle = [...chain, resolvedPath].map(p => path.basename(p)).join(' -> ');
          throw new CircularImportError(`Circular import detected: ${cycle}`);
        }

        if (visited.has(canonPath)) {
          continue;
        }
        visited.add(canonPath);

        let importedDoc = this.loadedDocs.get(resolvedPath);
        if (!importedDoc) {
          const content = this.fileLoader(resolvedPath);
          importedDoc = parseToad(content, resolvedPath);
          this.loadedDocs.set(resolvedPath, importedDoc);
        }

        const childDocs = this.loadImportsRecursive(importedDoc, resolvedPath, [...chain, resolvedPath], visited);
        docs.push(...childDocs);
      }
    }

    docs.push(doc);
    return docs;
  }

  // ==========================================================================
  // Variable Scope Resolution
  // ==========================================================================

  private resolveAllVariables(rawVars: Map<string, ValueNode>): Map<string, ValueNode> {
    const resolved = new Map<string, ValueNode>();
    const visiting = new Set<string>();

    const resolveVar = (name: string): ValueNode => {
      if (resolved.has(name)) return resolved.get(name)!;
      if (visiting.has(name)) {
        throw new CircularVariableError(`Circular variable dependency: >${name}`);
      }

      const rawVal = rawVars.get(name);
      if (!rawVal) {
        throw new Error(`Undefined variable '>${name}'`);
      }

      visiting.add(name);
      const resVal = this.substituteVariablesInValue(rawVal, (subName) => resolveVar(subName));
      visiting.delete(name);

      resolved.set(name, resVal);
      return resVal;
    };

    for (const name of rawVars.keys()) {
      resolveVar(name);
    }

    return resolved;
  }

  private substituteVariablesInValue(
    value: ValueNode,
    lookup: (name: string) => ValueNode | undefined
  ): ValueNode {
    if (!value) return value;

    switch (value.type) {
      case 'VariableReference': {
        const resolved = lookup(value.name);
        if (resolved) {
          return this.substituteVariablesInValue(resolved, lookup);
        }
        return value;
      }
      case 'CoordinateValue': {
        return {
          ...value,
          x: this.substituteVariablesInValue(value.x, lookup),
          y: this.substituteVariablesInValue(value.y, lookup)
        };
      }
      case 'RelationalPosition': {
        return {
          ...value,
          offset: value.offset ? this.substituteVariablesInValue(value.offset, lookup) : undefined
        };
      }
      case 'LinearGradient': {
        return {
          ...value,
          direction: value.direction ? this.substituteVariablesInValue(value.direction, lookup) : undefined,
          stops: value.stops.map(s => ({
            ...s,
            color: this.substituteVariablesInValue(s.color, lookup),
            position: s.position ? this.substituteVariablesInValue(s.position, lookup) : undefined
          }))
        };
      }
      case 'RadialGradient': {
        return {
          ...value,
          stops: value.stops.map(s => ({
            ...s,
            color: this.substituteVariablesInValue(s.color, lookup),
            position: s.position ? this.substituteVariablesInValue(s.position, lookup) : undefined
          }))
        };
      }
      case 'ConicGradient': {
        return {
          ...value,
          angle: value.angle ? this.substituteVariablesInValue(value.angle, lookup) : undefined,
          stops: value.stops.map(s => ({
            ...s,
            color: this.substituteVariablesInValue(s.color, lookup),
            position: s.position ? this.substituteVariablesInValue(s.position, lookup) : undefined
          }))
        };
      }
      case 'CalcValue': {
        let expr = value.expression;
        expr = expr.replace(/>([a-zA-Z_][a-zA-Z0-9_-]*)/g, (match, varName) => {
          const resolved = lookup(varName);
          if (resolved) {
            if (resolved.type === 'NumberLiteral' || resolved.type === 'DimensionLiteral') {
              return String((resolved as any).value) + (resolved.type === 'DimensionLiteral' ? (resolved as any).unit : '');
            }
          }
          return match;
        });
        return { ...value, expression: expr };
      }
      case 'FilterValue': {
        return {
          ...value,
          filters: value.filters.map(f => ({
            ...f,
            arguments: f.arguments.map(arg => this.substituteVariablesInValue(arg, lookup))
          }))
        };
      }
      case 'StrokeValue': {
        return {
          ...value,
          color: value.color ? this.substituteVariablesInValue(value.color, lookup) : undefined,
          width: value.width ? this.substituteVariablesInValue(value.width, lookup) : undefined
        };
      }
      case 'FontValue': {
        let fam = value.family;
        if (fam && fam.startsWith('>')) {
          const varName = fam.slice(1);
          const resolved = lookup(varName);
          if (resolved) {
            fam = this.extractString(resolved) || fam;
          }
        }
        return {
          ...value,
          family: fam,
          size: value.size ? this.substituteVariablesInValue(value.size, lookup) : undefined
        };
      }
      case 'PointsValue': {
        return {
          ...value,
          points: value.points.map(p => ({
            ...p,
            x: this.substituteVariablesInValue(p.x, lookup),
            y: this.substituteVariablesInValue(p.y, lookup)
          }))
        };
      }
      case 'ArrayLiteral': {
        return {
          ...value,
          elements: value.elements.map(e => this.substituteVariablesInValue(e, lookup))
        };
      }
      case 'ExpressionList': {
        return {
          ...value,
          expressions: value.expressions.map(e => this.substituteVariablesInValue(e, lookup))
        };
      }
      case 'ColorTransform': {
        const resColor = this.substituteVariablesInValue(value.color, lookup);
        const resAmt = this.substituteVariablesInValue(value.amount, lookup);
        const colorStr = this.extractColorString(resColor) || '#000000';
        const amtNum = this.extractNumber(resAmt) ?? 0.2;
        let transformed = colorStr;
        if (value.functionName === 'alpha') {
          transformed = applyAlpha(colorStr, amtNum);
        } else if (value.functionName === 'lighten') {
          transformed = lightenColor(colorStr, amtNum);
        } else if (value.functionName === 'darken') {
          transformed = darkenColor(colorStr, amtNum);
        }
        return {
          type: 'ColorLiteral',
          format: 'rgba',
          value: transformed,
          loc: value.loc
        };
      }
      default:
        return value;
    }
  }

  // ==========================================================================
  // Canvas Resolution
  // ==========================================================================

  private resolveSingleCanvas(
    canvasNode: CanvasDeclarationNode | undefined,
    vars: Map<string, ValueNode>,
    components: Map<string, ComponentDeclarationNode>
  ): ResolvedCanvasNode {
    let name = canvasNode?.name;
    let mode = canvasNode?.mode || 'graphic';
    let photoSrc = canvasNode?.photoSrc;
    let width = 0;
    let height = 0;
    let explicitWidth = false;
    let explicitHeight = false;
    let fill: string | ResolvedGradient | undefined;
    let ratioStr: string | undefined;
    let resolution: number | string | undefined;
    let density: number | undefined;
    let exportFormats: string[] | undefined;
    let scaleFactors: number[] | undefined;
    let quality: number | undefined;
    let bleed = 0;
    let cropMarks = false;
    let hasExplicitDpi = false;
    let dpi = 96;
    let colorMode: 'rgb' | 'cmyk' = 'rgb';
    const properties: Record<string, any> = {};

    if (canvasNode) {
      for (const prop of canvasNode.properties) {
        const val = this.substituteVariablesInValue(prop.value, n => vars.get(n));
        const propName = prop.name;

        if (propName === 'src' || propName === 'photo-src' || propName === 'photoSrc') {
          photoSrc = this.extractString(val) || photoSrc;
          mode = 'photo';
        } else if (propName === 'size' || propName === 'dimensions') {
          const dims = this.extractDimensions(val);
          if (dims) {
            width = typeof dims.w === 'number' ? dims.w : parseFloat(dims.w as string) || 800;
            height = typeof dims.h === 'number' ? dims.h : parseFloat(dims.h as string) || 600;
            explicitWidth = true;
            explicitHeight = true;
          }
        } else if (propName === 'width') {
          const w = this.extractNumber(val);
          if (w) { width = w; explicitWidth = true; }
        } else if (propName === 'height') {
          const h = this.extractNumber(val);
          if (h) { height = h; explicitHeight = true; }
        } else if (propName === 'fill' || propName === 'background' || propName === 'background-color' || propName === 'backgroundColor' || propName === 'color') {
          fill = this.extractColorOrGradient(val);
        } else if (propName === 'font-family' || propName === 'fontFamily' || propName === 'font') {
          properties.fontFamily = this.extractString(val);
        } else if (propName === 'bleed') {
          bleed = this.extractNumber(val) || 0;
        } else if (propName === 'crop-marks' || propName === 'cropMarks') {
          cropMarks = this.extractBoolean(val) ?? false;
        } else if (propName === 'dpi') {
          dpi = this.extractNumber(val) || 96;
          hasExplicitDpi = true;
        } else if (propName === 'color-mode' || propName === 'colorMode') {
          const cm = this.extractString(val)?.toLowerCase();
          if (cm === 'cmyk' || cm === 'rgb') colorMode = cm as any;
        } else if (propName === 'ratio' || propName === 'aspect-ratio' || propName === 'aspectRatio') {
          ratioStr = this.extractString(val) || (typeof this.extractRawValue(val) === 'string' ? this.extractRawValue(val) : undefined);
        } else if (propName === 'resolution') {
          if (val.type === 'DimensionLiteral') {
            resolution = (val as any).raw;
          } else {
            const raw = this.extractRawValue(val);
            if (typeof raw === 'number' || typeof raw === 'string') {
              resolution = raw;
            }
          }
        } else if (propName === 'density') {
          density = this.extractNumber(val);
        } else if (propName === 'export' || propName === 'exports' || propName === 'format' || propName === 'formats') {
          const raw = this.extractRawValue(val);
          if (Array.isArray(raw)) {
            exportFormats = raw.map(String).map(s => s.toLowerCase().trim().replace(/^['"]|['"]$/g, ''));
          } else if (typeof raw === 'string') {
            exportFormats = raw.split(/[\s,]+/).map(s => s.toLowerCase().trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
          }
        } else if (propName === 'scale' || propName === 'scales') {
          const raw = this.extractRawValue(val);
          if (Array.isArray(raw)) {
            scaleFactors = raw.map(Number).filter(n => !isNaN(n) && n > 0);
          } else if (typeof raw === 'number' && raw > 0) {
            scaleFactors = [raw];
          } else if (typeof raw === 'string') {
            scaleFactors = raw.split(/[\s,]+/).map(s => parseFloat(s.replace(/x$/i, ''))).filter(n => !isNaN(n) && n > 0);
          }
        } else if (propName === 'quality') {
          const num = this.extractNumber(val);
          if (num !== undefined) {
            const q = num <= 1 && num > 0 ? num * 100 : num;
            quality = Math.max(1, Math.min(100, Math.round(q)));
          }
        } else if (propName === 'compress' || propName === 'compression') {
          const num = this.extractNumber(val);
          if (num !== undefined) {
            const c = num <= 1 && num > 0 ? num * 100 : num;
            const q = 100 - c;
            quality = Math.max(1, Math.min(100, Math.round(q)));
          }
        } else if (propName === 'preset') {
          const presetName = this.extractString(val)?.toLowerCase();
          const PRESETS: Record<string, { w: number; h: number }> = {
            'og-image': { w: 1200, h: 630 },
            'banner': { w: 1920, h: 1080 },
            'github-banner': { w: 1280, h: 640 },
            'avatar': { w: 400, h: 400 },
            'app-icon': { w: 1024, h: 1024 },
            'favicon': { w: 32, h: 32 },
            'insta-post': { w: 1080, h: 1080 },
            'insta-story': { w: 1080, h: 1920 },
            'youtube-thumbnail': { w: 1280, h: 720 },
            'instagram-post': { w: 1080, h: 1080 },
            'instagram-story': { w: 1080, h: 1920 },
            'twitter-post': { w: 1200, h: 675 },
            'twitter-header': { w: 1500, h: 500 },
            'facebook-post': { w: 1200, h: 630 },
            'facebook-cover': { w: 820, h: 312 },
            'linkedin-post': { w: 1200, h: 627 },
            'pinterest-pin': { w: 1000, h: 1500 },
            'dribbble-shot': { w: 1600, h: 1200 },
            'a4': { w: 2480, h: 3508 },
            'a4-landscape': { w: 3508, h: 2480 }
          };
          if (presetName && PRESETS[presetName]) {
            if (!explicitWidth) width = PRESETS[presetName].w;
            if (!explicitHeight) height = PRESETS[presetName].h;
            explicitWidth = true;
            explicitHeight = true;
          } else if (presetName) {
            this.warnings.push(
              `Unknown canvas preset '${presetName}'. Supported presets: ${Object.keys(PRESETS).join(', ')}.`
            );
          }
        } else if (propName === 'guides' || propName === 'guide') {
          const rawGuides = this.extractRawValue(val);
          const guidesList: Array<{ location: number; direction: 'horizontal' | 'vertical' }> = [];
          const parseGuideItem = (item: any) => {
            if (!item) return;
            if (typeof item === 'object' && item.location !== undefined) {
              const loc = typeof item.location === 'number' ? item.location : parseFloat(item.location) || 0;
              const dir = item.direction === 'vertical' || item.direction === 'v' ? 'vertical' : 'horizontal';
              guidesList.push({ location: loc, direction: dir });
            } else if (typeof item === 'string') {
              // e.g. "horizontal 100px", "v 200", "150px h"
              const tokens = item.trim().split(/\s+/);
              let dir: 'horizontal' | 'vertical' = 'horizontal';
              let loc = 0;
              for (const tok of tokens) {
                if (['v', 'vert', 'vertical'].includes(tok.toLowerCase())) dir = 'vertical';
                else if (['h', 'horiz', 'horizontal'].includes(tok.toLowerCase())) dir = 'horizontal';
                else {
                  const n = parseFloat(tok);
                  if (!isNaN(n)) loc = n;
                }
              }
              guidesList.push({ location: loc, direction: dir });
            }
          };
          if (Array.isArray(rawGuides)) {
            rawGuides.forEach(parseGuideItem);
          } else {
            parseGuideItem(rawGuides);
          }
          properties.guides = guidesList;
        } else if (propName === 'global-light' || propName === 'globalLight') {
          const rawGl = this.extractRawValue(val);
          if (typeof rawGl === 'number') {
            properties.globalLight = { angle: rawGl, altitude: 30 };
          } else if (Array.isArray(rawGl)) {
            const angle = typeof rawGl[0] === 'number' ? rawGl[0] : parseFloat(rawGl[0]) || 90;
            const altitude = typeof rawGl[1] === 'number' ? rawGl[1] : parseFloat(rawGl[1]) || 30;
            properties.globalLight = { angle, altitude };
          } else if (typeof rawGl === 'object' && rawGl !== null) {
            properties.globalLight = {
              angle: typeof rawGl.angle === 'number' ? rawGl.angle : parseFloat(rawGl.angle) || 90,
              altitude: typeof rawGl.altitude === 'number' ? rawGl.altitude : parseFloat(rawGl.altitude) || 30
            };
          } else if (typeof rawGl === 'string') {
            const parts = rawGl.split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
            properties.globalLight = {
              angle: parts[0] ?? 90,
              altitude: parts[1] ?? 30
            };
          }
        } else if (propName === 'vignette') {
          if (val.type === 'DimensionLiteral' && val.unit === '%') {
            properties.vignette = (val.value ?? 0) / 100;
          } else {
            const num = this.extractNumber(val);
            properties.vignette = num !== undefined ? (num > 1 ? num / 100 : num) : undefined;
          }
        } else {
          properties[prop.name] = this.extractRawValue(val);
        }
      }
    }

    // Smart Ratio & Resolution Calculation
    if (ratioStr) {
      let rx = 16, ry = 9;
      let ratioValid = false;
      const parts = ratioStr.split(/[:/]/);
      if (parts.length === 2) {
        const px = parseFloat(parts[0]);
        const py = parseFloat(parts[1]);
        if (!isNaN(px) && !isNaN(py) && px > 0 && py > 0) {
          rx = px;
          ry = py;
          ratioValid = true;
        }
      }
      if (!ratioValid) {
        this.warnings.push(`Invalid canvas ratio '${ratioStr}' ignored; falling back to 16:9.`);
      }

      // Convert resolution to number
      let numRes: number | undefined;
      const resStr = String(resolution || '').toLowerCase().trim();
      const map: Record<string, number> = {
        '480p': 480, '480': 480, 'sd': 480,
        '720p': 720, 'hd': 720, '720': 720,
        '1080p': 1080, 'fhd': 1080, 'fullhd': 1080, '1080': 1080,
        '1440p': 1440, '2k': 1440, 'qhd': 1440, '1440': 1440,
        '2160p': 2160, '4k': 2160, 'uhd': 2160, '2160': 2160,
        '4320p': 4320, '8k': 4320, '4320': 4320
      };
      if (map[resStr]) {
        numRes = map[resStr];
      } else if (typeof resolution === 'number') {
        numRes = resolution;
      } else if (typeof resolution === 'string') {
        const parsed = parseFloat(resStr);
        if (!isNaN(parsed)) numRes = parsed;
      }

      if (density && !numRes) {
        // Density GCD formula
        const targetW = Math.round(rx * (density / ry));
        const targetH = Math.round(density);
        if (!explicitWidth) width = targetW;
        if (!explicitHeight) height = targetH;
      } else if (numRes && !isNaN(numRes) && numRes > 0) {
        if (rx >= ry) {
          // Landscape / Square: resolution represents height
          if (!explicitHeight) height = numRes;
          if (!explicitWidth) width = Math.round(numRes * (rx / ry));
        } else {
          // Portrait (e.g. 9:16, 4:5): resolution represents width (short edge)
          if (!explicitWidth) width = numRes;
          if (!explicitHeight) height = Math.round(numRes * (ry / rx));
        }
      } else {
        // Ratio only, no resolution given: default base height 1080 for landscape, width 1080 for portrait
        if (!explicitWidth && !explicitHeight) {
          if (rx >= ry) {
            height = 1080;
            width = Math.round(1080 * (rx / ry));
          } else {
            width = 1080;
            height = Math.round(1080 * (ry / rx));
          }
        } else if (explicitWidth && !explicitHeight) {
          height = Math.round(width * (ry / rx));
        } else if (explicitHeight && !explicitWidth) {
          width = Math.round(height * (rx / ry));
        }
      }
    }

    if (width <= 0) width = 800;
    if (height <= 0) height = 600;

    const aspectRatio = computeAspectRatio(width, height);

    // Expand canvas-level elements if defined inside canvas { ... }
    let canvasElements: ResolvedElementNode[] | undefined;
    if (canvasNode?.elements && canvasNode.elements.length > 0) {
      canvasElements = [];
      for (const elem of canvasNode.elements) {
        const expanded = this.expandElement(elem, components, vars, 0);
        if (Array.isArray(expanded)) {
          canvasElements.push(...expanded);
        } else if (expanded) {
          canvasElements.push(expanded);
        }
      }
    }

    return {
      name,
      mode,
      photoSrc,
      explicitWidth,
      explicitHeight,
      width,
      height,
      fill,
      aspectRatio,
      exports: exportFormats,
      scales: scaleFactors,
      resolution,
      dpi,
      hasExplicitDpi,
      bleed: bleed > 0 ? bleed : undefined,
      cropMarks: cropMarks || undefined,
      colorMode,
      ratio: ratioStr,
      quality,
      guides: properties.guides,
      globalLight: properties.globalLight,
      properties,
      elements: canvasElements
    };
  }

  // ==========================================================================
  // Component Expansion & Element Resolution
  // ==========================================================================

  private expandElement(
    elem: ElementNode,
    components: Map<string, ComponentDeclarationNode>,
    vars: Map<string, ValueNode>,
    depth: number,
    idPrefix?: string,
    slotChildren?: ResolvedElementNode[]
  ): ResolvedElementNode | ResolvedElementNode[] | null {
    if (depth > this.maxComponentDepth) {
      throw new ComponentRecursionLimitError(
        `Component recursion limit exceeded (${this.maxComponentDepth})`
      );
    }

    if (elem.type === 'SlotElement') {
      return slotChildren || null;
    }

    // Check if element is custom component instantiation
    const compDecl =
      elem.type === 'ComponentInstance'
        ? components.get((elem as ComponentInstanceNode).componentName)
        : components.get(elem.type.replace('Element', ''));

    if (compDecl) {
      return this.expandComponentInstance(
        elem as ComponentInstanceNode,
        compDecl,
        components,
        vars,
        depth + 1,
        idPrefix
      );
    }

    // Standard primitive element (rect, circle, text, polygon, image, group, grid)
    return this.resolvePrimitiveElement(elem, components, vars, depth, idPrefix, slotChildren);
  }

  private expandComponentInstance(
    instance: ComponentInstanceNode,
    compDecl: ComponentDeclarationNode,
    components: Map<string, ComponentDeclarationNode>,
    parentVars: Map<string, ValueNode>,
    depth: number,
    outerPrefix?: string
  ): ResolvedElementNode | ResolvedElementNode[] | null {
    this.instanceCounter++;
    const instId = instance.id || `inst${this.instanceCounter}`;
    const prefix = outerPrefix ? `${outerPrefix}_${instId}` : instId;

    // 1. Build local variable scope for component parameters
    const localVars = new Map<string, ValueNode>(parentVars);

    // Map positional & named arguments. Positional args bind to parameters
    // in declaration order independent of any interleaved named args.
    const args = instance.arguments || [];
    const unnamedArgs = args.filter(a => !a.name);
    let unnamedIdx = 0;
    for (let i = 0; i < compDecl.parameters.length; i++) {
      const param = compDecl.parameters[i];
      // Check named arg
      const namedArg = args.find(a => a.name === param.name);
      // Check named property on instance body { paramName: val }
      const namedProp = instance.properties?.find(p => p.name === param.name);

      if (namedArg) {
        const evaluated = this.substituteVariablesInValue(namedArg.value, n => parentVars.get(n));
        localVars.set(param.name, evaluated);
      } else if (namedProp) {
        const evaluated = this.substituteVariablesInValue(namedProp.value, n => parentVars.get(n));
        localVars.set(param.name, evaluated);
      } else if (unnamedIdx < unnamedArgs.length) {
        // Positional arg
        const evaluated = this.substituteVariablesInValue(unnamedArgs[unnamedIdx++].value, n => parentVars.get(n));
        localVars.set(param.name, evaluated);
      } else if (param.defaultValue) {
        // Default value evaluated in localVars so it can reference earlier component parameters
        const evaluated = this.substituteVariablesInValue(param.defaultValue, n => localVars.get(n));
        localVars.set(param.name, evaluated);
      } else {
        throw new Error(
          `Missing required parameter '${param.name}' for component '${compDecl.name}'`
        );
      }
    }

    // 2. Expand component instance children (for slots). They are namespaced
    // with the instance prefix exactly like body elements, so two instances
    // providing same-named slot children cannot collide.
    const evaluatedSlotChildren: ResolvedElementNode[] = [];
    if (instance.children) {
      for (const child of instance.children) {
        const exp = this.expandElement(child, components, parentVars, depth, prefix);
        if (Array.isArray(exp)) {
          evaluatedSlotChildren.push(...exp);
        } else if (exp) {
          evaluatedSlotChildren.push(exp);
        }
      }
    }

    // 3. Expand component body elements
    const expandedChildren: ResolvedElementNode[] = [];

    // Body elements
    for (const child of compDecl.elements) {
      const exp = this.expandElement(child, components, localVars, depth, prefix, evaluatedSlotChildren);
      if (Array.isArray(exp)) {
        expandedChildren.push(...exp);
      } else if (exp) {
        expandedChildren.push(exp);
      }
    }

    // Remap internal relational anchors so component parts can position
    // themselves relative to each other: body ids were prefixed with the
    // instance id, and relational targetIds must follow the same scheme.
    if (prefix) {
      const localIds = new Set<string>();
      const collectIds = (el: any) => {
        if (!el || typeof el !== 'object') return;
        if (typeof el.id === 'string') localIds.add(el.id);
        if (Array.isArray(el.children)) el.children.forEach(collectIds);
      };
      compDecl.elements.forEach(collectIds);
      if (localIds.size > 0) {
        const remapTargets = (el: any) => {
          if (!el || typeof el !== 'object') return;
          const rel = el.at && el.at.relational;
          if (rel && typeof rel.targetId === 'string' &&
              rel.targetId !== 'canvas' && rel.targetId !== 'parent' &&
              localIds.has(rel.targetId)) {
            rel.targetId = `${prefix}_${rel.targetId}`;
          }
          if (Array.isArray(el.children)) el.children.forEach(remapTargets);
        };
        expandedChildren.forEach(remapTargets);
      }
    }

    // 3. If component body is a single element without outer group, merge instance properties directly
    if (expandedChildren.length === 1 && (!compDecl.properties || compDecl.properties.length === 0)) {
      const singleChild = expandedChildren[0];
      if (instance.id) {
        singleChild.id = instance.id;
      }
      if (instance.name) {
        singleChild.name = instance.name;
      }
      // Apply instance override properties (excluding declared component parameters)
      const nonParamProps = instance.properties?.filter(
        p => !compDecl.parameters.some(param => param.name === p.name)
      );
      this.applyPropertiesToResolved(singleChild, nonParamProps, localVars);
      return singleChild;
    }

    // Otherwise create a GroupElement wrapping the component output
    const groupNode: ResolvedElementNode = {
      id: instance.id || (outerPrefix ? `${outerPrefix}_${instId}` : undefined),
      name: instance.name || compDecl.name,
      type: 'group',
      isComponent: true,
      children: expandedChildren
    };

    // Apply component declaration level properties and instance properties
    const nonParamProps = instance.properties?.filter(
      p => !compDecl.parameters.some(param => param.name === p.name)
    );
    this.applyPropertiesToResolved(groupNode, compDecl.properties, localVars);
    this.applyPropertiesToResolved(groupNode, nonParamProps, localVars);

    return groupNode;
  }

  private resolvePrimitiveElement(
    elem: ElementNode,
    components: Map<string, ComponentDeclarationNode>,
    vars: Map<string, ValueNode>,
    depth: number,
    idPrefix?: string,
    slotChildren?: ResolvedElementNode[]
  ): ResolvedElementNode {
    const rawType = elem.type.replace('Element', '').toLowerCase() as any;
    const resolvedId = elem.id ? (idPrefix ? `${idPrefix}_${elem.id}` : elem.id) : undefined;

    const resolved: ResolvedElementNode = {
      id: resolvedId,
      name: elem.name || elem.id || rawType,
      type: rawType
    };

    if (elem.type === 'ShapeElement') {
      resolved.shapeType = (elem as any).shapeType;
    }

    if (rawType === 'image' && elem.name) {
      resolved.src = elem.name;
    }

    let elemText = (elem as TextElementNode).text;
    if (rawType === 'text' && elemText) {
      if (elemText.startsWith('>') || elemText.startsWith('$')) {
        const varName = elemText.slice(1);
        const resolvedVar = vars.get(varName);
        if (resolvedVar) {
          const str = this.extractString(resolvedVar);
          elemText = str !== undefined ? str : (resolvedVar as any).value !== undefined ? String((resolvedVar as any).value) : elemText;
        }
      }
      resolved.text = elemText;
    }

    // Apply properties
    this.applyPropertiesToResolved(resolved, elem.properties, vars);

    if (rawType === 'text' && this.defaultFontFamily) {
      if (!resolved.font) {
        resolved.font = { family: this.defaultFontFamily, size: 16, weight: 'normal', style: 'normal' };
      } else if (!resolved.font.family || resolved.font.family === 'sans-serif') {
        resolved.font.family = this.defaultFontFamily;
      }
    }

    // Resolve children (for groups / grids)
    if (elem.children && elem.children.length > 0) {
      const resolvedChildren: ResolvedElementNode[] = [];
      for (const child of elem.children) {
        const exp = this.expandElement(child, components, vars, depth + 1, idPrefix, slotChildren);
        if (Array.isArray(exp)) {
          resolvedChildren.push(...exp);
        } else if (exp) {
          resolvedChildren.push(exp);
        }
      }
      resolved.children = resolvedChildren;
    }

    return resolved;
  }

  private applyPropertiesToResolved(
    target: ResolvedElementNode,
    properties: PropertyNode[],
    vars: Map<string, ValueNode>
  ): void {
    if (!properties) return;

    for (const prop of properties) {
      const val = this.substituteVariablesInValue(prop.value, n => vars.get(n));
      const name = prop.name;

      switch (name) {
        case 'at':
        case 'position': {
          target.at = this.extractPosition(val);
          break;
        }
        case 'size':
        case 'dimensions': {
          target.size = this.extractDimensions(val);
          break;
        }
        case 'width': {
          const w = this.extractSizeValue(val);
          if (w !== undefined) target.size = { ...(target.size || {}), w };
          break;
        }
        case 'height': {
          const h = this.extractSizeValue(val);
          if (h !== undefined) target.size = { ...(target.size || {}), h };
          break;
        }
        case 'fill':
        case 'background': {
          target.fill = this.extractColorOrGradient(val);
          break;
        }
        case 'color': {
          // typographic color or fallback fill
          const col = this.extractColorString(val);
          if (col) {
            target.fill = target.fill || col;
          }
          break;
        }
        case 'stroke': {
          target.stroke = this.extractStroke(val);
          break;
        }
        case 'opacity': {
          // Percentage form is normalized (50% -> 0.5); extractNumber alone
          // would keep the raw scalar 50 and render a fully opaque element.
          if (val.type === 'DimensionLiteral' && val.unit === '%') {
            target.opacity = (val.value ?? 0) / 100;
          } else {
            target.opacity = this.extractNumber(val);
          }
          break;
        }
        case 'blend-mode':
        case 'blendMode': {
          target.blendMode = this.extractString(val);
          break;
        }
        case 'rotation': {
          target.rotation = this.extractNumber(val);
          break;
        }
        case 'radius':
        case 'border-radius':
        case 'borderRadius': {
          target.radius = this.extractRadius(val);
          const num = this.extractNumber(val);
          if (num !== undefined) target.adjustRadius = num;
          break;
        }
        case 'feather': {
          target.feather = this.extractNumber(val);
          break;
        }
        case 'exposure':
        case 'contrast':
        case 'brightness':
        case 'saturation':
        case 'saturate':
        case 'warmth':
        case 'temperature':
        case 'highlights': {
          if (!target.adjustParams) target.adjustParams = {};
          let key = name;
          if (key === 'saturate') key = 'saturation';
          if (key === 'temperature') key = 'warmth';
          let num: number | undefined;
          if (val.type === 'DimensionLiteral' && val.unit === '%') {
            num = (val.value ?? 0) / 100;
          } else {
            num = this.extractNumber(val);
          }
          if (num !== undefined) {
            (target.adjustParams as any)[key] = num;
          }
          break;
        }
        case 'filter': {
          target.filter = this.extractFilters(val);
          break;
        }
        case 'backdrop-filter':
        case 'backdropFilter': {
          target.backdropFilter = this.extractFilters(val);
          break;
        }
        case 'clip': {
          target.clip = this.extractBoolean(val);
          break;
        }
        case 'text':
        case 'content': {
          target.text = this.extractString(val);
          break;
        }
        case 'font': {
          target.font = this.extractFont(val);
          break;
        }
        case 'font-family':
        case 'fontFamily': {
          const fam = this.extractString(val);
          target.font = { ...(target.font || { size: 16, weight: 'normal', style: 'normal', family: fam || this.defaultFontFamily || 'sans-serif' }), family: fam || this.defaultFontFamily || 'sans-serif' };
          break;
        }
        case 'font-size':
        case 'fontSize': {
          const s = this.extractNumber(val) || 16;
          target.font = { ...(target.font || { size: s, weight: 'normal', style: 'normal', family: this.defaultFontFamily || 'sans-serif' }), size: s };
          break;
        }
        case 'font-weight':
        case 'fontWeight':
        case 'weight': {
          const rawW = this.extractString(val) || (this.extractNumber(val) !== undefined ? String(this.extractNumber(val)) : 'normal');
          // The canvas/SVG font shorthand only accepts numbers or
          // normal|bold|bolder|lighter — map descriptive names to numbers so
          // e.g. `semibold` does not silently invalidate the whole shorthand.
          const WEIGHT_WORDS: Record<string, string> = {
            thin: '100', extralight: '200', ultralight: '200', light: '300',
            regular: '400', medium: '500', semibold: '600', demibold: '600',
            extrabold: '800', ultrabold: '800', black: '900', heavy: '900'
          };
          const lw = rawW.toLowerCase();
          const w = WEIGHT_WORDS[lw] ?? rawW;
          target.font = { ...(target.font || { size: 16, weight: w, style: 'normal', family: this.defaultFontFamily || 'sans-serif' }), weight: w };
          break;
        }
        case 'font-style':
        case 'fontStyle':
        case 'style': {
          const s = (this.extractString(val) as any) || 'normal';
          target.font = { ...(target.font || { size: 16, weight: 'normal', style: s, family: this.defaultFontFamily || 'sans-serif' }), style: s };
          break;
        }
        case 'line-height':
        case 'lineHeight': {
          const lh = this.extractNumber(val);
          target.font = { ...(target.font || { size: 16, weight: 'normal', style: 'normal', family: this.defaultFontFamily || 'sans-serif' }), lineHeight: lh };
          break;
        }
        case 'wrap-width':
        case 'wrapWidth': {
          (target as any).wrapWidth = this.extractSizeValue(val);
          break;
        }
        case 'max-lines':
        case 'maxLines': {
          (target as any).maxLines = this.extractNumber(val);
          break;
        }
        case 'overflow': {
          const ov = this.extractString(val);
          if (ov === 'ellipsis' || ov === 'hidden' || ov === 'clip' || ov === 'visible') {
            (target as any).overflow = ov;
          }
          break;
        }
        case 'vertical-align':
        case 'verticalAlign': {
          (target as any).verticalAlign = this.extractString(val);
          break;
        }
        case 'align':
        case 'text-align': {
          target.align = this.extractString(val) as any;
          break;
        }
        case 'points': {
          target.points = this.extractPoints(val);
          break;
        }
        case 'src': {
          target.src = this.extractString(val);
          break;
        }
        case 'fit': {
          target.fit = this.extractString(val) as any;
          break;
        }
        case 'columns': {
          target.columns = this.extractNumber(val);
          break;
        }
        case 'gap': {
          target.gap = this.extractNumber(val);
          break;
        }
        case 'row-gap':
        case 'rowGap': {
          target.rowGap = this.extractNumber(val);
          break;
        }
        case 'column-gap':
        case 'columnGap': {
          target.columnGap = this.extractNumber(val);
          break;
        }
        case 'flow': {
          target.flow = this.extractString(val) as any;
          break;
        }
        case 'd':
        case 'path': {
          target.d = this.extractString(val);
          break;
        }
        case 'stroke-cap':
        case 'strokeCap':
        case 'cap': {
          const cap = this.extractString(val) as any;
          target.strokeCap = cap;
          if (target.stroke) target.stroke.cap = cap;
          break;
        }
        case 'stroke-join':
        case 'strokeJoin':
        case 'join': {
          const join = this.extractString(val) as any;
          target.strokeJoin = join;
          if (target.stroke) target.stroke.join = join;
          break;
        }
        case 'letter-spacing':
        case 'letterSpacing':
        case 'tracking': {
          const ls = this.extractNumber(val);
          target.letterSpacing = ls;
          if (target.font) target.font.letterSpacing = ls;
          break;
        }
        case 'text-transform':
        case 'textTransform': {
          const tt = this.extractString(val) as any;
          target.textTransform = tt;
          if (target.font) target.font.textTransform = tt;
          break;
        }
        case 'direction': {
          target.direction = this.extractString(val) as any;
          break;
        }
        case 'padding': {
          target.padding = this.extractRadius(val);
          break;
        }
        case 'margin': {
          target.margin = this.extractRadius(val);
          break;
        }
        case 'shadow':
        case 'box-shadow':
        case 'drop-shadow': {
          target.shadow = this.extractShadow(val);
          break;
        }
        case 'inner-shadow':
        case 'innerShadow': {
          target.innerShadow = this.extractShadow(val);
          break;
        }
        case 'glow':
        case 'outer-glow':
        case 'outerGlow': {
          target.outerGlow = this.extractGlow(val);
          break;
        }
        case 'inner-glow':
        case 'innerGlow': {
          target.innerGlow = this.extractGlow(val);
          break;
        }
        case 'bevel':
        case 'bevel-emboss':
        case 'bevelEmboss': {
          target.bevel = this.extractBevel(val);
          break;
        }
        case 'stroke-style':
        case 'strokeStyle': {
          // 'stroke-style' configures the dash pattern of the element's own
          // stroke; it must not be confused with the layer-stroke FX.
          const dashVal = this.extractString(val);
          if (dashVal === 'dashed' || dashVal === 'dotted' || dashVal === 'solid') {
            if (!target.stroke) {
              target.stroke = { color: '#000000', width: 1, style: dashVal } as any;
            } else {
              target.stroke.style = dashVal;
            }
          } else {
            // Not a dash keyword: treat as a layer-stroke FX specification
            // (legacy behavior, e.g. "stroke-style: 3px #ff0000 inside").
            target.layerStroke = this.extractLayerStroke(val);
          }
          break;
        }
        case 'layer-stroke':
        case 'layerStroke': {
          target.layerStroke = this.extractLayerStroke(val);
          break;
        }
        case 'overlay':
        case 'color-overlay':
        case 'colorOverlay':
        case 'gradient-overlay':
        case 'gradientOverlay': {
          const overlayVal = this.extractColorOrGradient(val);
          if (typeof overlayVal === 'string') {
            target.colorOverlay = overlayVal;
          } else if (overlayVal) {
            target.gradientOverlay = overlayVal;
          }
          break;
        }
        case 'font-features':
        case 'fontFeatures': {
          const ff = this.extractFontFeatures(val);
          target.fontFeatures = ff;
          if (target.font) target.font.fontFeatures = ff;
          break;
        }
        case 'font-variation':
        case 'fontVariation': {
          const fv = this.extractFontVariation(val);
          target.fontVariation = fv;
          if (target.font) target.font.fontVariation = fv;
          break;
        }
        case 'hanging-punctuation':
        case 'hangingPunctuation': {
          const hp = this.extractBoolean(val) ?? true;
          target.hangingPunctuation = hp;
          if (target.font) target.font.hangingPunctuation = hp;
          break;
        }
        case 'scale': {
          if (val.type === 'CoordinateValue') {
            target.scale = { x: this.extractNumber(val.x) || 1, y: this.extractNumber(val.y) || 1 };
          } else if (val.type === 'ExpressionList') {
            target.scale = { x: this.extractNumber(val.expressions[0]) || 1, y: this.extractNumber(val.expressions[1]) || 1 };
          } else if (val.type === 'ArrayLiteral' && val.elements.length >= 2) {
            target.scale = { x: this.extractNumber(val.elements[0]) || 1, y: this.extractNumber(val.elements[1]) || 1 };
          } else {
            target.scale = this.extractNumber(val);
          }
          break;
        }
        case 'skew-x':
        case 'skewX': {
          target.skewX = this.extractNumber(val);
          break;
        }
        case 'skew-y':
        case 'skewY': {
          target.skewY = this.extractNumber(val);
          break;
        }
        case 'transform-origin':
        case 'transformOrigin': {
          if (val.type === 'CoordinateValue') {
            // NOTE: `||` would coerce a legitimate 0 origin to the default.
            target.transformOrigin = {
              x: this.originPart(val.x, '50%'),
              y: this.originPart(val.y, '50%')
            };
          } else if (val.type === 'ExpressionList') {
            target.transformOrigin = {
              x: this.originPart(val.expressions[0], '50%'),
              y: this.originPart(val.expressions[1], '50%')
            };
          } else {
            const str = this.originPart(val, '');
            target.transformOrigin = { x: str, y: str };
          }
          break;
        }
        case 'z-index':
        case 'zIndex': {
          target.zIndex = this.extractNumber(val);
          break;
        }
        case 'mask': {
          let maskId = this.extractString(val);
          if (!maskId && val.type === 'ColorLiteral' && typeof val.value === 'string' && val.value.startsWith('#')) {
            // Hex-like ids (e.g. #cafe) lex as colors; in reference position
            // they unambiguously mean an element id.
            maskId = val.value;
          }
          target.mask = maskId;
          break;
        }
        case 'icon-name':
        case 'iconName': {
          target.iconName = this.extractString(val);
          break;
        }
        case 'fill-opacity':
        case 'fillOpacity': {
          if (val.type === 'DimensionLiteral' && val.unit === '%') {
            target.fillOpacity = (val.value ?? 0) / 100;
          } else {
            const num = this.extractNumber(val);
            target.fillOpacity = num !== undefined ? (num > 1 ? num / 100 : num) : undefined;
          }
          break;
        }
        case 'layer-color':
        case 'layerColor': {
          const col = this.extractString(val)?.toLowerCase();
          const validColors = ['none', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'gray'];
          if (col && validColors.includes(col)) {
            target.layerColor = col as any;
          }
          break;
        }
        case 'lock':
        case 'protected': {
          const lockVal = this.extractString(val)?.toLowerCase();
          if (lockVal === 'all' || lockVal === 'position' || lockVal === 'transparency' || lockVal === 'composite') {
            target.lock = lockVal;
          } else if (this.extractBoolean(val) === true) {
            target.lock = 'all';
          }
          break;
        }
        case 'knockout': {
          target.knockout = this.extractBoolean(val);
          break;
        }
        case 'shadows': {
          const raw = this.extractRawValue(val);
          if (Array.isArray(raw)) {
            target.shadows = raw.map(item => {
              if (typeof item === 'object' && item !== null) {
                return {
                  offsetX: typeof item.offsetX === 'number' ? item.offsetX : parseFloat(item.offsetX) || 0,
                  offsetY: typeof item.offsetY === 'number' ? item.offsetY : parseFloat(item.offsetY) || 0,
                  blur: typeof item.blur === 'number' ? item.blur : parseFloat(item.blur) || 0,
                  color: item.color ? String(item.color) : '#000000',
                  useGlobalLight: !!item.useGlobalLight,
                  ...(item.noise !== undefined ? { noise: Number(item.noise) } : {})
                };
              }
              return { offsetX: 0, offsetY: 4, blur: 10, color: '#000000' };
            });
          } else {
            let num: number | undefined;
            if (val.type === 'DimensionLiteral' && val.unit === '%') {
              num = (val.value ?? 0) / 100;
            } else {
              num = this.extractNumber(val);
            }
            if (num !== undefined) {
              if (!target.adjustParams) target.adjustParams = {};
              target.adjustParams.shadows = num;
            }
          }
          break;
        }
        default: {
          const suggestion = suggestProperty(name);
          if (suggestion) {
            this.warnings.push(`Unknown property '${name}' on element '${target.id || target.name}'. Did you mean '${suggestion}'?`);
          } else {
            this.warnings.push(`Unknown property '${name}' on element '${target.id || target.name}'.`);
          }
          break;
        }
      }
    }
  }

  // ==========================================================================
  // Value Extraction Helpers
  // ==========================================================================

  private extractPositionAxis(val: ValueNode): number | string | undefined {
    if (!val) return undefined;
    if (val.type === 'DimensionLiteral' && val.unit === '%') {
      return `${val.value}%`;
    }
    if (val.type === 'StringLiteral' && val.value.endsWith('%')) {
      return val.value;
    }
    if (val.type === 'CalcValue') {
      return `calc(${val.expression})`;
    }
    return this.extractNumber(val);
  }

  private extractPosition(val: ValueNode): {
    x?: number | string;
    y?: number | string;
    relational?: { relation: any; targetId: string; offset: number | { x: number; y: number } };
  } {
    if (!val) return {};

    if (val.type === 'RelationalPosition') {
      let offset: number | { x: number; y: number } = 0;
      if (val.offset) {
        const off = val.offset as any;
        if (off.type === 'CoordinateValue') {
          offset = { x: this.extractNumber(off.x) || 0, y: this.extractNumber(off.y) || 0 };
        } else {
          offset = this.extractNumber(off) || 0;
        }
      }
      return {
        relational: {
          relation: val.relation,
          targetId: val.target,
          offset
        }
      };
    }

    if (val.type === 'CoordinateValue') {
      return {
        x: this.extractPositionAxis(val.x),
        y: this.extractPositionAxis(val.y)
      };
    }

    // "at: calc(...) 50px" and similar two-axis lists: each axis is
    // evaluated independently so a calc() on one axis cannot swallow the
    // other coordinate.
    if (val.type === 'ExpressionList') {
      const axes = val.expressions.map(e => this.extractPositionAxis(e));
      if (axes.length === 1) {
        return { x: axes[0], y: axes[0] };
      }
      return { x: axes[0], y: axes[1] };
    }

    const pos = this.extractPositionAxis(val);
    if (pos !== undefined) {
      return { x: pos, y: pos };
    }

    return {};
  }

  private extractSizeValue(val: ValueNode, dpi = 96): number | string | undefined {
    if (!val) return undefined;
    if (val.type === 'NumberLiteral') return val.value;
    if (val.type === 'DimensionLiteral') {
      if (val.unit === '%') return `${val.value}%`;
      if (['mm', 'cm', 'in', 'pt'].includes(val.unit)) {
        return convertDimensionToPx(val.value, val.unit, dpi);
      }
      // Font- and viewport-relative units must survive as strings so the
      // layout solver can resolve them with the proper context.
      if (['em', 'rem', 'vw', 'vh'].includes(val.unit)) {
        return `${val.value}${val.unit}`;
      }
      return val.value;
    }
    if (val.type === 'Identifier') {
      if (val.name === 'hug' || val.name === 'fill' || val.name === 'auto') return val.name;
    }
    if (val.type === 'StringLiteral') {
      if (val.value === 'hug' || val.value === 'fill' || val.value === 'auto') return val.value;
      if (val.value.endsWith('%')) return val.value;
    }
    if (val.type === 'CalcValue') {
      return `calc(${val.expression})`;
    }
    return undefined;
  }

  /**
   * Extracts a transform-origin axis part without falsy-zero coercion:
   * a legitimate `0` must not fall through to the percentage default.
   */
  private originPart(val: ValueNode | undefined, fallback: string): number | string {
    if (!val) return fallback;
    const size = this.extractSizeValue(val);
    if (size !== undefined) return size;
    const str = this.extractString(val);
    return str !== undefined ? str : fallback;
  }

  private extractDimensions(val: ValueNode, dpi = 96): { w: number | string; h: number | string } | undefined {
    if (!val) return undefined;

    if (val.type === 'CoordinateValue') {
      return {
        w: this.extractSizeValue(val.x, dpi) ?? 0,
        h: this.extractSizeValue(val.y, dpi) ?? 0
      };
    }

    if (val.type === 'ExpressionList' && val.expressions.length >= 2) {
      return {
        w: this.extractSizeValue(val.expressions[0], dpi) ?? 0,
        h: this.extractSizeValue(val.expressions[1], dpi) ?? 0
      };
    }

    const num = this.extractSizeValue(val, dpi);
    if (num !== undefined) {
      return { w: num, h: num };
    }

    return undefined;
  }

  private extractNumber(val: ValueNode, dpi = 96): number | undefined {
    if (!val) return undefined;
    if (val.type === 'NumberLiteral') {
      return val.value;
    }
    if (val.type === 'DimensionLiteral') {
      return convertDimensionToPx(val.value, val.unit, dpi);
    }
    // calc() expressions are valid anywhere a dimension is (positions,
    // sizes, offsets); evaluate them with the same finite-result guard the
    // layout solver uses.
    if ((val as any).type === 'CalcValue') {
      const evaluated = this.evalCalcExpression((val as any).expression ?? '');
      return evaluated !== undefined && Number.isFinite(evaluated) ? evaluated : 0;
    }
    return undefined;
  }

  /**
   * Evaluates a calc() expression body ("10px / 0", "20px * 2 + 10px").
   * Unit suffixes are stripped after conversion; division by zero yields
   * a non-finite result which callers clamp to 0.
   */
  private evalCalcExpression(expr: string): number | undefined {
    if (typeof expr !== 'string' || expr.trim() === '') return undefined;
    // Convert physical units at CSS-reference 96 DPI (parity with
    // evaluateCalc in math.ts) instead of silently stripping them.
    const normalized = expr
      .replace(/(-?\d+(?:\.\d+)?)(px|mm|cm|in|pt|em|rem)/gi, (_m, num: string, unit: string) => {
        const v = parseFloat(num);
        const u = unit.toLowerCase();
        if (u === 'mm') return String(v * (96 / 25.4));
        if (u === 'cm') return String(v * (96 / 2.54));
        if (u === 'in') return String(v * 96);
        if (u === 'pt') return String(v * (96 / 72));
        if (u === 'em' || u === 'rem') return String(v * 16);
        return String(v);
      })
      .replace(/(-?\d+(?:\.\d+)?)%/g, (_, num: string) => String(parseFloat(num)));
    if (!/^[0-9.+\-*/\s()]+$/.test(normalized)) return undefined;
    try {
      const result = new Function(`return (${normalized})`)();
      return typeof result === 'number' ? result : undefined;
    } catch {
      return undefined;
    }
  }

  private extractGlow(val: ValueNode): import('./ast.js').GlowStyle | undefined {
    if (!val) return undefined;
    let size = 10;
    let color = '#ffffff';
    let opacity = 1;

    if (val.type === 'ExpressionList' || val.type === 'ArrayLiteral') {
      const list = val.type === 'ExpressionList' ? val.expressions : val.elements;
      for (const item of list) {
        const num = this.extractNumber(item);
        if (num !== undefined && (item.type === 'DimensionLiteral' || item.type === 'NumberLiteral')) {
          size = num;
        } else {
          const col = this.extractColorString(item);
          if (col) color = col;
        }
      }
      return { size, color, opacity };
    }

    if (val.type === 'CoordinateValue') {
      const num1 = this.extractNumber(val.x);
      const col1 = this.extractColorString(val.x);
      const num2 = this.extractNumber(val.y);
      const col2 = this.extractColorString(val.y);
      if (num1 !== undefined) size = num1;
      else if (col1) color = col1;
      if (num2 !== undefined) size = num2;
      else if (col2) color = col2;
      return { size, color, opacity };
    }

    if (val.type === 'DimensionLiteral' || val.type === 'NumberLiteral') {
      return { size: this.extractNumber(val) || 10, color: '#ffffff', opacity: 1 };
    }

    const col = this.extractColorString(val);
    if (col) {
      return { size: 10, color: col, opacity: 1 };
    }

    return undefined;
  }

  private extractBevel(val: ValueNode): import('./ast.js').BevelStyle | undefined {
    if (!val) return undefined;
    let type: import('./ast.js').BevelStyle['type'] = 'inner-bevel';
    let size = 4;
    let depth = 100;
    let soften = 0;
    let direction: 'up' | 'down' = 'up';

    if (val.type === 'ExpressionList' || val.type === 'ArrayLiteral') {
      const list = val.type === 'ExpressionList' ? val.expressions : val.elements;
      for (const item of list) {
        if (item.type === 'Identifier' || item.type === 'StringLiteral') {
          const str = (item as any).value || (item as any).name;
          const sLower = str.toLowerCase();
          if (['inner-bevel', 'outer-bevel', 'emboss', 'pillow-emboss', 'stroke-emboss', 'smooth', 'chisel-hard', 'chisel-soft'].includes(sLower)) {
            type = sLower as any;
          } else if (sLower === 'up' || sLower === 'down') {
            direction = sLower as any;
          }
        } else if (item.type === 'DimensionLiteral' || item.type === 'NumberLiteral') {
          const num = this.extractNumber(item) || 0;
          if (size === 4) size = num;
          else if (soften === 0) soften = num;
        }
      }
      return { type, size, depth, soften, direction };
    }

    if (val.type === 'DimensionLiteral' || val.type === 'NumberLiteral') {
      return { type, size: this.extractNumber(val) || 4, depth, soften, direction };
    }

    if (val.type === 'Identifier' || val.type === 'StringLiteral') {
      const s = ((val as any).value || (val as any).name || '').toLowerCase();
      if (['inner-bevel', 'outer-bevel', 'emboss', 'pillow-emboss', 'stroke-emboss', 'smooth', 'chisel-hard', 'chisel-soft'].includes(s)) {
        type = s as any;
      }
      return { type, size: 4, depth, soften, direction };
    }

    return undefined;
  }

  private extractLayerStroke(val: ValueNode): import('./ast.js').LayerStrokeStyle | undefined {
    if (!val) return undefined;
    let position: 'inside' | 'outside' | 'center' = 'inside';
    let width = 1;
    let color = '#000000';

    if (val.type === 'ExpressionList' || val.type === 'ArrayLiteral') {
      const list = val.type === 'ExpressionList' ? val.expressions : val.elements;
      for (const item of list) {
        if (item.type === 'Identifier' || item.type === 'StringLiteral') {
          const s = ((item as any).value || (item as any).name || '').toLowerCase();
          if (s === 'inside' || s === 'outside' || s === 'center') {
            position = s;
          } else {
            const col = this.extractColorString(item);
            if (col) color = col;
          }
        } else if (item.type === 'DimensionLiteral' || item.type === 'NumberLiteral') {
          width = this.extractNumber(item) || 1;
        } else {
          const col = this.extractColorString(item);
          if (col) color = col;
        }
      }
      return { position, width, color };
    }

    if (val.type === 'DimensionLiteral' || val.type === 'NumberLiteral') {
      return { position, width: this.extractNumber(val) || 1, color };
    }

    const col = this.extractColorString(val);
    if (col) {
      return { position, width: 1, color: col };
    }

    return undefined;
  }

  private extractFontFeatures(val: ValueNode): string | string[] | undefined {
    if (!val) return undefined;
    if (val.type === 'StringLiteral') return val.value;
    if (val.type === 'Identifier') return val.name;
    if (val.type === 'ArrayLiteral') {
      return val.elements.map(e => this.extractString(e) || '').filter(Boolean);
    }
    if (val.type === 'ExpressionList') {
      return val.expressions.map(e => this.extractString(e) || '').filter(Boolean);
    }
    return undefined;
  }

  private extractFontVariation(val: ValueNode): Record<string, number> | string | undefined {
    if (!val) return undefined;
    if (val.type === 'StringLiteral') return val.value;
    if (val.type === 'Identifier') return val.name;
    if (val.type === 'ArrayLiteral' || val.type === 'ExpressionList') {
      const list = val.type === 'ArrayLiteral' ? val.elements : val.expressions;
      const strParts = list.map(e => this.extractString(e) ?? this.extractNumber(e) ?? '').filter(Boolean);
      return strParts.join(' ');
    }
    return undefined;
  }

  private extractString(val: ValueNode): string | undefined {
    if (!val) return undefined;
    if (val.type === 'StringLiteral') return val.value;
    if (val.type === 'Identifier') return val.name;
    if (val.type === 'ElementReference') return val.targetId;
    return undefined;
  }

  private extractBoolean(val: ValueNode): boolean | undefined {
    if (!val) return undefined;
    if (val.type === 'BooleanLiteral') return val.value;
    if (val.type === 'Identifier') return val.name === 'true';
    return undefined;
  }

  private extractColorString(val: ValueNode): string | undefined {
    if (!val) return undefined;
    if (val.type === 'ColorLiteral') return val.value;
    if (val.type === 'StringLiteral') return val.value;
    if (val.type === 'Identifier') return val.name;
    return undefined;
  }

  private extractColorOrGradient(val: ValueNode): string | ResolvedGradient | undefined {
    if (!val) return undefined;
    if (val.type === 'ColorLiteral') return val.value;
    if (val.type === 'StringLiteral') return val.value;
    if (val.type === 'Identifier') return val.name;

    if (val.type === 'LinearGradient') {
      let angleDeg = 180; // default to bottom
      let directionStr = 'to bottom';
      let hasExplicitAngle = false;

      if (val.direction) {
        if (val.direction.type === 'DimensionLiteral' && val.direction.unit === 'deg') {
          angleDeg = val.direction.value;
          hasExplicitAngle = true;
        } else if (val.direction.type === 'StringLiteral' || val.direction.type === 'Identifier') {
          directionStr = (val.direction as any).value || (val.direction as any).name;
        }
      }

      const stops = this.resolveGradientStops(val.stops);
      // Steering hint contract: emit EITHER the keyword direction OR the
      // numeric angle — never both, since consumers prefer direction and a
      // leftover default would silently override an explicit angle.
      return {
        type: 'linear',
        angleDeg,
        ...(hasExplicitAngle ? {} : { direction: directionStr }),
        stops
      };
    }

    if (val.type === 'RadialGradient') {
      const stops = this.resolveGradientStops(val.stops);
      return {
        type: 'radial',
        shape: val.shape || 'circle',
        stops
      };
    }

    if (val.type === 'ConicGradient') {
      let angleDeg = 0;
      if (val.angle) {
        if (val.angle.type === 'DimensionLiteral' && val.angle.unit === 'deg') {
          angleDeg = val.angle.value;
        } else if (val.angle.type === 'NumberLiteral') {
          angleDeg = val.angle.value;
        }
      }
      const stops = this.resolveGradientStops(val.stops);
      return {
        type: 'conic',
        angleDeg,
        stops
      };
    }

    return undefined;
  }

  private resolveGradientStops(stops: any[]): Array<{ color: string; offset: number }> {
    if (!stops || stops.length === 0) return [];
    const n = stops.length;

    const result: Array<{ color: string; offset: number }> = stops.map((s, idx) => {
      const color = this.extractColorString(s.color) || '#000000';
      let offset = -1;
      if (s.position) {
        if (s.position.type === 'DimensionLiteral' && s.position.unit === '%') {
          offset = s.position.value / 100;
        } else if (s.position.type === 'NumberLiteral') {
          offset = s.position.value > 1 ? s.position.value / 100 : s.position.value;
        }
      }
      return { color, offset };
    });

    // Distribute missing stop offsets
    if (result[0].offset === -1) result[0].offset = 0;
    if (result[n - 1].offset === -1) result[n - 1].offset = 1;

    let lastDefined = 0;
    for (let i = 1; i < n; i++) {
      if (result[i].offset !== -1) {
        const start = result[lastDefined].offset;
        const end = result[i].offset;
        const step = (end - start) / (i - lastDefined);
        for (let k = lastDefined + 1; k < i; k++) {
          result[k].offset = start + step * (k - lastDefined);
        }
        lastDefined = i;
      }
    }

    return result;
  }

  private extractStroke(val: ValueNode): ResolvedStroke | undefined {
    if (!val) return undefined;
    if (val.type === 'StrokeValue') {
      const color = val.color ? this.extractColorString(val.color) || '#000000' : '#000000';
      const width = val.width ? this.extractNumber(val.width) || 1 : 1;
      const style = val.style || 'solid';
      return { color, width, style };
    }

    const num = this.extractNumber(val);
    if (num !== undefined) {
      return { color: '#000000', width: num, style: 'solid' };
    }

    const col = this.extractColorString(val);
    if (col) {
      return { color: col, width: 1, style: 'solid' };
    }

    return undefined;
  }

  private extractShadow(val: ValueNode): { offsetX: number; offsetY: number; blur: number; color: string } | undefined {
    if (!val) return undefined;
    if (val.type === 'ExpressionList') {
      let offsetX = 0;
      let offsetY = 0;
      let blur = 0;
      let color = '#000000';
      const numValues: number[] = [];

      for (const item of val.expressions) {
        const num = this.extractNumber(item);
        if (num !== undefined && (item.type === 'DimensionLiteral' || item.type === 'NumberLiteral')) {
          numValues.push(num);
        } else {
          const col = this.extractColorString(item);
          if (col) color = col;
        }
      }

      if (numValues.length >= 1) offsetX = numValues[0];
      if (numValues.length >= 2) offsetY = numValues[1];
      if (numValues.length >= 3) blur = numValues[2];

      return { offsetX, offsetY, blur, color };
    }

    if (val.type === 'DimensionLiteral' || val.type === 'NumberLiteral') {
      const b = this.extractNumber(val) || 0;
      return { offsetX: 0, offsetY: 0, blur: b, color: '#000000' };
    }

    return undefined;
  }

  private extractFont(val: ValueNode): ResolvedFont | undefined {
    if (!val) return undefined;
    if (val.type === 'FontValue') {
      const size = val.size ? this.extractNumber(val.size) || 16 : 16;
      let family = val.family || 'sans-serif';
      if ((family.startsWith('"') && family.endsWith('"')) || (family.startsWith("'") && family.endsWith("'"))) {
        family = family.slice(1, -1);
      }
      const weight = val.weight || 'normal';
      const style = val.style || 'normal';
      return { family, size, weight, style };
    }
    return undefined;
  }

  private extractRadius(val: ValueNode): number | [number, number, number, number] | undefined {
    if (!val) return undefined;
    if (val.type === 'NumberLiteral') {
      return val.value;
    }
    if (val.type === 'DimensionLiteral') {
      // Physical units must convert to px (e.g. radius: 5mm), not leak raw.
      const px = convertDimensionToPx(val.value, (val as any).unit);
      return Number.isFinite(px) ? px : val.value;
    }
    if (val.type === 'CoordinateValue') {
      const v1 = this.extractNumber(val.x) || 0;
      const v2 = this.extractNumber(val.y) || 0;
      return [v1, v2, v1, v2];
    }
    if (val.type === 'ArrayLiteral') {
      if (val.elements.length === 1) {
        return this.extractNumber(val.elements[0]);
      }
      if (val.elements.length === 2) {
        const v1 = this.extractNumber(val.elements[0]) || 0;
        const v2 = this.extractNumber(val.elements[1]) || 0;
        return [v1, v2, v1, v2];
      }
      if (val.elements.length === 3) {
        // CSS-style partial: [tl, trAndBl, br]
        const a = this.extractNumber(val.elements[0]) || 0;
        const b = this.extractNumber(val.elements[1]) || 0;
        const c = this.extractNumber(val.elements[2]) || 0;
        return [a, b, c, b];
      }
      if (val.elements.length >= 4) {
        return [
          this.extractNumber(val.elements[0]) || 0,
          this.extractNumber(val.elements[1]) || 0,
          this.extractNumber(val.elements[2]) || 0,
          this.extractNumber(val.elements[3]) || 0
        ];
      }
    }
    if (val.type === 'ExpressionList') {
      if (val.expressions.length === 1) {
        return this.extractNumber(val.expressions[0]);
      }
      if (val.expressions.length === 2) {
        const v1 = this.extractNumber(val.expressions[0]) || 0;
        const v2 = this.extractNumber(val.expressions[1]) || 0;
        return [v1, v2, v1, v2];
      }
      if (val.expressions.length === 3) {
        const a = this.extractNumber(val.expressions[0]) || 0;
        const b = this.extractNumber(val.expressions[1]) || 0;
        const c = this.extractNumber(val.expressions[2]) || 0;
        return [a, b, c, b];
      }
      if (val.expressions.length >= 4) {
        return [
          this.extractNumber(val.expressions[0]) || 0,
          this.extractNumber(val.expressions[1]) || 0,
          this.extractNumber(val.expressions[2]) || 0,
          this.extractNumber(val.expressions[3]) || 0
        ];
      }
    }
    return undefined;
  }

  /** Renders a value node back to CSS-ish text (for filter arguments). */
  private stringifyFilterArg(v: ValueNode): string {
    if (!v) return '';
    switch (v.type) {
      case 'DimensionLiteral': return `${(v as any).value}${(v as any).unit || ''}`;
      case 'NumberLiteral': return String((v as any).value);
      case 'Identifier': return String((v as any).name ?? '');
      case 'StringLiteral': return String((v as any).value ?? '');
      case 'ColorLiteral': return String((v as any).value ?? '');
      case 'ColorTransform': {
        const ct = v as any;
        const fn = ct.functionName || 'mix';
        const colorStr = this.stringifyFilterArg(ct.color);
        const amtStr = ct.amount ? this.stringifyFilterArg(ct.amount) : '';
        return amtStr ? `${fn}(${colorStr}, ${amtStr})` : `${fn}(${colorStr})`;
      }
      case 'ExpressionList':
        return v.expressions.map(e => this.stringifyFilterArg(e)).join(' ');
      case 'CoordinateValue':
        return [this.stringifyFilterArg(v.x), this.stringifyFilterArg(v.y)].filter(Boolean).join(' ');
      case 'CalcValue':
        return `calc(${(v as any).expression})`;
      default: {
        const num = this.extractNumber(v);
        if (num !== undefined) return String(num);
        return this.extractString(v) ?? '';
      }
    }
  }

  private extractFilters(val: ValueNode): ResolvedFilter[] | undefined {
    if (!val) return undefined;
    if (val.type === 'FilterValue') {
      return val.filters.map(f => {
        // Keep EVERY argument: drop-shadow needs "<dx> <dy> <blur> <color>"
        // intact, hue-rotate may carry units, etc.
        const argStr = f.arguments.length > 0
          ? f.arguments.map(a => this.stringifyFilterArg(a)).filter(s => s !== '').join(' ')
          : '';
        return {
          type: f.name,
          value: argStr
        };
      });
    }
    return undefined;
  }

  private extractPoints(val: ValueNode): Array<{ x: number; y: number }> | undefined {
    if (!val) return undefined;
    if (val.type === 'PointsValue') {
      return val.points.map(p => ({
        x: this.extractNumber(p.x) || 0,
        y: this.extractNumber(p.y) || 0
      }));
    }
    if (val.type === 'ArrayLiteral') {
      return val.elements.map(el => {
        if (el.type === 'CoordinateValue') {
          return {
            x: this.extractNumber(el.x) || 0,
            y: this.extractNumber(el.y) || 0
          };
        }
        if (el.type === 'ExpressionList' && el.expressions.length >= 2) {
          return {
            x: this.extractNumber(el.expressions[0]) || 0,
            y: this.extractNumber(el.expressions[1]) || 0
          };
        }
        if ((el as any).type === 'Point2D') {
          return {
            x: this.extractNumber((el as any).x) || 0,
            y: this.extractNumber((el as any).y) || 0
          };
        }
        return { x: 0, y: 0 };
      });
    }
    return undefined;
  }

  private extractRawValue(val: ValueNode): any {
    if (!val) return undefined;
    if (val.type === 'NumberLiteral' || val.type === 'DimensionLiteral') return val.value;
    if (val.type === 'StringLiteral') return val.value;
    if (val.type === 'BooleanLiteral') return val.value;
    if (val.type === 'ColorLiteral') return val.value;
    if (val.type === 'Identifier') return val.name;
    if (val.type === 'ArrayLiteral') return val.elements.map(el => this.extractRawValue(el));
    if (val.type === 'ExpressionList') return val.expressions.map(el => this.extractRawValue(el));
    if (val.type === 'CoordinateValue') return [this.extractRawValue(val.x), this.extractRawValue(val.y)];
    return val;
  }
}
