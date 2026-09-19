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
 * Detects supported hardware-accelerated video encoders for the current FFmpeg binary.
 */
const hwEncoderCache = new Map<string, { encoder: string; extraArgs: string[] } | null>();

export function detectFfmpegHwEncoder(ffmpegBin: string): { encoder: string; extraArgs: string[] } | null {
  if (hwEncoderCache.has(ffmpegBin)) return hwEncoderCache.get(ffmpegBin)!;
  try {
    const encodersOut = execSync(`"${ffmpegBin}" -encoders`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();

    // 1. NVIDIA NVENC (Highest performance and quality)
    if (encodersOut.includes('h264_nvenc')) {
      try {
        // Quick verification probe with a 256x256 test frame
        execSync(`"${ffmpegBin}" -y -f lavfi -i color=c=black:s=256x256:d=0.1 -c:v h264_nvenc -preset p6 -cq 20 -f null -`, {
          stdio: 'ignore'
        });
        const val = {
          encoder: 'h264_nvenc',
          extraArgs: ['-preset', 'p6', '-cq', '20', '-b:v', '0', '-spatial-aq', '1']
        };
        hwEncoderCache.set(ffmpegBin, val);
        return val;
      } catch {}
    }

    // 2. Intel QuickSync (QSV)
    if (encodersOut.includes('h264_qsv')) {
      try {
        execSync(`"${ffmpegBin}" -y -f lavfi -i color=c=black:s=256x256:d=0.1 -c:v h264_qsv -global_quality 20 -f null -`, {
          stdio: 'ignore'
        });
        const val = {
          encoder: 'h264_qsv',
          extraArgs: ['-global_quality', '20']
        };
        hwEncoderCache.set(ffmpegBin, val);
        return val;
      } catch {}
    }

    // 3. AMD AMF
    if (encodersOut.includes('h264_amf')) {
      try {
        execSync(`"${ffmpegBin}" -y -f lavfi -i color=c=black:s=256x256:d=0.1 -c:v h264_amf -quality quality -f null -`, {
          stdio: 'ignore'
        });
        const val = {
          encoder: 'h264_amf',
          extraArgs: ['-quality', 'quality']
        };
        hwEncoderCache.set(ffmpegBin, val);
        return val;
      } catch {}
    }
  } catch {}

  hwEncoderCache.set(ffmpegBin, null);
  return null;
}

/**
 * Resets the cached hardware encoder detection (primarily for unit tests).
 */
export function resetFfmpegHwEncoderCache(): void {
  hwEncoderCache.clear();
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
    const framesDir = outputPath.endsWith('.png')
      ? path.join(path.dirname(outputPath), `${path.basename(outputPath, '.png')}_frames`)
      : outputPath;
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
    extraArgs = [
      '-c:v',
      'libvpx-vp9',
      '-vf',
      'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-pix_fmt',
      'yuva420p',
      '-auto-alt-ref',
      '0'
    ];
  } else {
    // Hardware acceleration (NVIDIA NVENC, Intel QSV, AMD AMF) with CPU fallback
    const hw = detectFfmpegHwEncoder(ffmpegBin);
    if (hw) {
      extraArgs = [
        '-c:v',
        hw.encoder,
        ...hw.extraArgs,
        '-vf',
        'pad=ceil(iw/2)*2:ceil(ih/2)*2',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart'
      ];
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

    let isSettled = false;
    const cleanupHandler = () => {
      try {
        if (!ffmpeg.killed) {
          ffmpeg.kill('SIGKILL');
        }
      } catch {}
    };
    process.once('exit', cleanupHandler);
    process.once('SIGINT', cleanupHandler);
    process.once('SIGTERM', cleanupHandler);

    const removeListeners = () => {
      process.removeListener('exit', cleanupHandler);
      process.removeListener('SIGINT', cleanupHandler);
      process.removeListener('SIGTERM', cleanupHandler);
    };

    let stderr = '';
    ffmpeg.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.stdin?.on('error', (err: any) => {
      // F-065: EPIPE occurs when FFmpeg exits before all frames are written; handled in close event
      if (err.code !== 'EPIPE') {
        // ignore or let close handler reject with stderr
      }
    });

    ffmpeg.on('error', (err) => {
      removeListeners();
      if (!isSettled) {
        isSettled = true;
        reject(new Error(`Failed to spawn FFmpeg process: ${err.message}`));
      }
    });

    ffmpeg.on('close', (code) => {
      removeListeners();
      if (!isSettled) {
        isSettled = true;
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg exited with error code ${code}: ${stderr}`));
        }
      }
    });

    // Feed raw RGBA frames into stdin
    (async () => {
      try {
        for (let frame = 0; frame < totalFrames; frame++) {
          if (ffmpeg.stdin?.destroyed || !ffmpeg.stdin?.writable || isSettled) {
            break;
          }
          const time = frame / fps;
          const canvas = solver.renderFrame(time);
          const rawRgba = canvas.data();

          const canWrite = ffmpeg.stdin.write(rawRgba);
          if (!canWrite && !ffmpeg.stdin.destroyed) {
            await new Promise<void>((drainResolve, drainReject) => {
              const timer = setTimeout(() => {
                drainReject(new Error('FFmpeg stdin drain timed out'));
              }, 10000);
              ffmpeg.stdin.once('drain', () => {
                clearTimeout(timer);
                drainResolve();
              });
              ffmpeg.stdin.once('error', () => {
                clearTimeout(timer);
                drainResolve(); // Handled by close event
              });
            });
          }

          if (options.onProgress) {
            options.onProgress(frame + 1, totalFrames);
          }
        }
        if (!ffmpeg.stdin?.destroyed && ffmpeg.stdin?.writable) {
          ffmpeg.stdin.end();
        }
      } catch (err) {
        try {
          ffmpeg.kill();
        } catch {}
        removeListeners();
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      }
    })();
  });
}
