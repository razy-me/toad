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
  format?: 'mp4' | 'webm' | 'frames';
  fps?: number;
  ffmpegPath?: string;
  onProgress?: (currentFrame: number, totalFrames: number) => void;
}

/**
 * Checks if FFmpeg binary is available on PATH or custom path.
 */
export function isFfmpegAvailable(customPath?: string): boolean {
  const bin = customPath || process.env.FFMPEG_PATH || 'ffmpeg';
  try {
    execSync(`${bin} -version`, { stdio: 'ignore' });
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

  const format = options.format ?? (outputPath.endsWith('.webm') ? 'webm' : outputPath.endsWith('.png') ? 'frames' : 'mp4');

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

  // 2. MP4 / WebM via FFmpeg pipe streaming
  const ffmpegBin = options.ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';

  if (!isFfmpegAvailable(ffmpegBin)) {
    throw new Error(
      `FFmpeg was not found in PATH or FFMPEG_PATH. To export ${format.toUpperCase()}, please install FFmpeg (e.g. 'winget install Gyan.FFmpeg') or export as frame sequence with --format frames.`
    );
  }

  // Sample first frame to get exact canvas dimensions
  const testFrame = solver.renderFrame(0);
  const width = testFrame.width;
  const height = testFrame.height;

  const vcodec = format === 'webm' ? 'libvpx-vp9' : 'libx264';
  const extraArgs = format === 'webm'
    ? ['-pix_fmt', 'yuva420p', '-auto-alt-ref', '0']
    : ['-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

  const args = [
    '-y',
    '-f', 'rawvideo',
    '-vcodec', 'rawvideo',
    '-s', `${width}x${height}`,
    '-pix_fmt', 'rgba',
    '-r', `${fps}`,
    '-i', '-',
    '-c:v', vcodec,
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
