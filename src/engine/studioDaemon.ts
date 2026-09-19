/**
 * src/engine/studioDaemon.ts
 * Background process daemon manager for TOAD Studio.
 * Allows running the Studio Web-GUI persistently without keeping a terminal open.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as http from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export interface StudioDaemonInfo {
  pid: number;
  port: number;
  url: string;
  entryFile?: string;
  startTime: number;
}

const TOAD_DIR = path.join(os.homedir(), '.toad');
const DAEMON_FILE = path.join(TOAD_DIR, 'studio-daemon.json');

export function getDaemonInfo(): StudioDaemonInfo | null {
  try {
    if (!fs.existsSync(DAEMON_FILE)) return null;
    const raw = fs.readFileSync(DAEMON_FILE, 'utf-8');
    const info = JSON.parse(raw) as StudioDaemonInfo;
    if (typeof info?.pid === 'number' && typeof info?.port === 'number') {
      return info;
    }
  } catch {}
  return null;
}

export function saveDaemonInfo(info: StudioDaemonInfo): void {
  try {
    if (!fs.existsSync(TOAD_DIR)) {
      fs.mkdirSync(TOAD_DIR, { recursive: true });
    }
    fs.writeFileSync(DAEMON_FILE, JSON.stringify(info, null, 2), 'utf-8');
  } catch {}
}

export function clearDaemonInfo(): void {
  try {
    if (fs.existsSync(DAEMON_FILE)) {
      fs.unlinkSync(DAEMON_FILE);
    }
  } catch {}
}

/**
 * Probes whether the server is responding on the given port.
 */
export async function isStudioServerRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/status`, { timeout: 400 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Gracefully or forcefully stops the running Studio daemon.
 */
export async function stopStudioDaemon(): Promise<{ success: boolean; message: string }> {
  const info = getDaemonInfo();
  if (!info) {
    // Also probe default port 3000 to see if an unrecorded instance exists
    const running = await isStudioServerRunning(3000);
    if (!running) {
      return { success: true, message: 'Kein TOAD Studio Server aktiv.' };
    }
  }

  const port = info?.port || 3000;
  const pid = info?.pid;

  // 1. Try sending graceful shutdown request over HTTP
  try {
    await new Promise<void>((resolve) => {
      const req = http.request(
        `http://127.0.0.1:${port}/api/shutdown`,
        { method: 'POST', timeout: 800 },
        () => resolve()
      );
      req.on('error', () => resolve());
      req.on('timeout', () => {
        req.destroy();
        resolve();
      });
      req.end();
    });
  } catch {}

  // 2. Kill PID if still alive
  if (pid) {
    try {
      if (process.platform === 'win32') {
        try {
          execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'ignore' });
        } catch {}
      } else {
        process.kill(pid, 'SIGTERM');
      }
    } catch {}
  }

  clearDaemonInfo();
  return { success: true, message: `TOAD Studio (Port ${port}) wurde erfolgreich beendet.` };
}

/**
 * Spawns TOAD Studio detached in background so the user can close the terminal.
 */
export async function startStudioDaemon(
  port: number,
  entryFile?: string
): Promise<{ url: string; pid: number; isExisting: boolean }> {
  // 1. Check if already running on this port
  const running = await isStudioServerRunning(port);
  const existingInfo = getDaemonInfo();

  if (running && existingInfo && existingInfo.port === port) {
    return { url: existingInfo.url, pid: existingInfo.pid, isExisting: true };
  }

  if (running) {
    return { url: `http://localhost:${port}/`, pid: existingInfo?.pid || 0, isExisting: true };
  }

  // 2. Determine CLI script location
  let cliScript: string;
  try {
    const currentFile = fileURLToPath(import.meta.url);
    cliScript = path.resolve(path.dirname(currentFile), '../cli.js');
    if (!fs.existsSync(cliScript)) {
      cliScript = path.resolve(process.cwd(), 'dist/cli.js');
    }
  } catch {
    cliScript = path.resolve(process.cwd(), 'dist/cli.js');
  }

  const args = [cliScript, 'studio', '--foreground', '--no-browser', '--port', String(port)];
  if (entryFile) {
    args.push(entryFile);
  }

  // 3. Detached spawn
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();

  const pid = child.pid || 0;
  const url = `http://localhost:${port}/`;

  saveDaemonInfo({
    pid,
    port,
    url,
    entryFile,
    startTime: Date.now()
  });

  // 4. Wait up to 2 seconds for server to start responding
  const maxAttempts = 15;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 120));
    if (await isStudioServerRunning(port)) {
      break;
    }
  }

  return { url, pid, isExisting: false };
}
