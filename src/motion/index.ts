/**
 * src/motion/index.ts
 * Public exports for the TOAD Motion module (.toadm).
 */

export * from './ast.js';
export * from './lexer.js';
export * from './parser.js';
export * from './interpolator.js';
export * from './pathSampler.js';
export * from './sceneLoader.js';
export * from './motionSolver.js';
export * from './videoExporter.js';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseMotion } from './parser.js';
import { loadMotionScene } from './sceneLoader.js';
import { MotionSolver } from './motionSolver.js';
import { exportMotionVideo, VideoExportOptions } from './videoExporter.js';

export interface CompileMotionOptions {
  outputPath?: string;
  format?: 'mp4' | 'webm' | 'gif' | 'frames';
  fps?: number;
  ffmpegPath?: string;
  onProgress?: (currentFrame: number, totalFrames: number) => void;
}

/**
 * High-level compilation entry point for a .toadm file.
 */
export async function compileMotion(
  motionFilePath: string,
  options: CompileMotionOptions = {}
): Promise<string> {
  const resolvedPath = path.resolve(motionFilePath);
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const code = fs.readFileSync(resolvedPath, 'utf-8');
  const doc = parseMotion(code, resolvedPath);

  // Determine scene file from imports or scene name
  let scenePath: string | undefined;
  if (doc.motion.scene) {
    const matchedImport = doc.imports.find(imp => imp.alias === doc.motion.scene);
    if (matchedImport) {
      scenePath = path.resolve(dir, matchedImport.path);
    } else {
      throw new Error(
        `Scene alias '${doc.motion.scene}' specified in motion block was not found in @imports. Available imports: ${doc.imports.map(i => `'${i.alias}'`).join(', ') || 'none'}`
      );
    }
  } else if (doc.imports.length > 0) {
    scenePath = path.resolve(dir, doc.imports[0]!.path);
  }

  if (!scenePath) {
    throw new Error(`No scene specified in motion definition and no @import found in ${resolvedPath}`);
  }

  const scene = await loadMotionScene(scenePath, dir);
  const solver = new MotionSolver(doc, scene);

  const fps = options.fps ?? doc.motion.fps ?? 60;
  const duration = doc.motion.duration ?? 3.0;
  const ext =
    options.format === 'gif'
      ? '.gif'
      : options.format === 'webm'
      ? '.webm'
      : options.format === 'frames'
      ? ''
      : '.mp4';
  const defaultOut = path.join(dir, 'dist', path.basename(resolvedPath, '.toadm') + ext);
  const outputPath = options.outputPath ?? defaultOut;

  return exportMotionVideo(solver, duration, fps, {
    outputPath,
    format: options.format,
    fps,
    ffmpegPath: options.ffmpegPath,
    onProgress: options.onProgress
  });
}
