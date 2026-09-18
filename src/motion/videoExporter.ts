/**
 * src/motion/videoExporter.ts
 * Streaming frame exporter for TOAD Motion.
 * Supports MP4 / WebM via FFmpeg pipe streaming, as well as PNG frame sequences.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { MotionSolver } from './motionSolver.js';

export interface VideoExportOptions {
  outputPath: string;
  format?: 'mp4' | 'webm' | 'gif' | 'frames';
  fps?: number;
  ffmpegPath?: string;
  onProgress?: (currentFrame: number, totalFrames: number) => void;
}

/**
 * Resolves FFmpeg binary path, checking customPath, FFMPEG_PATH, system PATH,
 * and common Windows winget installation directories.
 */
export function resolveFfmpegBin(customPath?: string): string {
  if (customPath) return customPath;
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {}
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const wingetBase = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages');
    if (fs.existsSync(wingetBase)) {
      try {
        const matches = fs.readdirSync(wingetBase).filter(d => d.toLowerCase().includes('gyan.ffmpeg'));
        for (const match of matches) {
          const inner = path.join(wingetBase, match);
          const subdirs = fs.readdirSync(inner);
          for (const sub of subdirs) {
            const candidate = path.join(inner, sub, 'bin', 'ffmpeg.exe');
            if (fs.existsSync(candidate)) return candidate;
          }
        }
      } catch {}
    }
  }
  return 'ffmpeg';
}

/**
 * Checks if FFmpeg binary is available on PATH, custom path, or known install locations.
 */
export function isFfmpegAvailable(customPath?: string): boolean {
  const bin = resolveFfmpegBin(customPath);
  try {
    execSync(`"${bin}" -version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Exports a TOAD Motion animation to video or frame sequence.
 */
export async function exportMotionVideo(
  solver: MotionSolver,
  duration: number,
  fps: number,
  options: VideoExportOptions
): Promise<string> {
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const outputPath = path.resolve(options.outputPath);
  const outDir = path.dirname(outputPath);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const format =
    options.format ??
    (outputPath.endsWith('.gif')
      ? 'gif'
      : outputPath.endsWith('.webm')
      ? 'webm'
      : outputPath.endsWith('.png')
      ? 'frames'
      : 'mp4');

  // 1. Frame sequence export
  if (format === 'frames') {
    const framesDir = outputPath.endsWith('.png') ? path.dirname(outputPath) : outputPath;
    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame / fps;
      const canvas = solver.renderFrame(time);
      const frameBuffer = canvas.encodeSync('png');
      const frameFile = path.join(framesDir, `frame_${String(frame).padStart(5, '0')}.png`);
      fs.writeFileSync(frameFile, frameBuffer);

      if (options.onProgress) {
        options.onProgress(frame + 1, totalFrames);
      }
    }

    return framesDir;
  }

  // 2. MP4 / WebM / GIF via FFmpeg pipe streaming
  const ffmpegBin = resolveFfmpegBin(options.ffmpegPath);

  if (!isFfmpegAvailable(ffmpegBin)) {
    throw new Error(
      `FFmpeg was not found in PATH or FFMPEG_PATH. To export ${format.toUpperCase()}, please install FFmpeg (e.g. 'winget install Gyan.FFmpeg') or export as frame sequence with --format frames.`
    );
  }

  // Sample first frame to get exact canvas dimensions
  const testFrame = solver.renderFrame(0);
  const width = testFrame.width;
  const height = testFrame.height;

  let extraArgs: string[] = [];
  if (format === 'gif') {
    extraArgs = [
      '-filter_complex',
      'split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer'
    ];
  } else if (format === 'webm') {
    extraArgs = ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0'];
  } else {
    extraArgs = [
      '-c:v',
      'libx264',
      '-vf',
      'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart'
    ];
  }

  const args = [
    '-y',
    '-f',
    'rawvideo',
    '-vcodec',
    'rawvideo',
    '-s',
    `${width}x${height}`,
    '-pix_fmt',
    'rgba',
    '-r',
    `${fps}`,
    '-i',
    '-',
    ...extraArgs,
    outputPath
  ];

  return new Promise<string>((resolve, reject) => {
    const ffmpeg = spawn(ffmpegBin, args, { stdio: ['pipe', 'ignore', 'pipe'] });

    let stderr = '';
    ffmpeg.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg process: ${err.message}`));
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg exited with error code ${code}: ${stderr}`));
      }
    });

    // Feed raw RGBA frames into stdin
    (async () => {
      try {
        for (let frame = 0; frame < totalFrames; frame++) {
          const time = frame / fps;
          const canvas = solver.renderFrame(time);
          const rawRgba = canvas.data();

          const canWrite = ffmpeg.stdin.write(rawRgba);
          if (!canWrite) {
            await new Promise<void>((drainResolve) => ffmpeg.stdin.once('drain', drainResolve));
          }

          if (options.onProgress) {
            options.onProgress(frame + 1, totalFrames);
          }
        }
        ffmpeg.stdin.end();
      } catch (err) {
        ffmpeg.kill();
        reject(err);
      }
    })();
  });
}
