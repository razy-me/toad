/**
 * src/engine/terminalRunner.ts
 * Manages dispatching commands to a persistent, reusable CMD / Terminal window.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const userKey = (process.env.USER || process.env.USERNAME || 'toad_user').replace(/[^a-zA-Z0-9_-]/g, '_');
export const toadTerminalDir = path.join(os.tmpdir(), `toad_term_${userKey}`);
if (!fs.existsSync(toadTerminalDir)) {
  try {
    fs.mkdirSync(toadTerminalDir, { recursive: true, mode: 0o700 });
  } catch {}
}
const pidFile = path.join(toadTerminalDir, 'toad_terminal.pid');
export const terminalQueueDir = path.join(toadTerminalDir, 'queue');
if (!fs.existsSync(terminalQueueDir)) {
  try {
    fs.mkdirSync(terminalQueueDir, { recursive: true, mode: 0o700 });
  } catch {}
}
const queueFile = path.join(toadTerminalDir, 'toad_terminal_cmd.json');
const cancelFile = path.join(toadTerminalDir, 'toad_terminal_cancel.flag');
const childPidFile = path.join(toadTerminalDir, 'toad_terminal_child.pid');

export function isTerminalSessionActive(): boolean {
  if (!fs.existsSync(pidFile)) return false;
  try {
    const rawPid = fs.readFileSync(pidFile, 'utf-8').trim();
    const pid = parseInt(rawPid, 10);
    if (!pid || isNaN(pid)) return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function abortLiveTerminalCommand(): { aborted: boolean; message: string } {
  if (!isTerminalSessionActive()) {
    return { aborted: false, message: 'Kein aktives Terminal-Fenster gefunden.' };
  }

  // 1. If child PID file exists, kill process tree immediately
  if (fs.existsSync(childPidFile)) {
    try {
      const childPid = parseInt(fs.readFileSync(childPidFile, 'utf-8').trim(), 10);
      if (childPid && !isNaN(childPid)) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(childPid), '/T', '/F'], { stdio: 'ignore' });
        } else {
          try {
            process.kill(-childPid, 'SIGINT');
          } catch {
            try { process.kill(childPid, 'SIGINT'); } catch {}
          }
        }
      }
    } catch {}
  }

  // 2. Write cancel flag for worker
  try {
    fs.writeFileSync(cancelFile, '1', 'utf-8');
  } catch {}

  return { aborted: true, message: 'Befehl im Terminal abgebrochen.' };
}

export function executeInLiveTerminal(command: string, cwd?: string): { success: boolean; reused: boolean } {
  const targetCwd = cwd ? path.resolve(cwd) : process.cwd();
  const active = isTerminalSessionActive();

  if (!active) {
    // Resolve terminalWorker.js path
    let workerScript: string;
    try {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      workerScript = path.resolve(currentDir, 'terminalWorker.js');
      if (!fs.existsSync(workerScript)) {
        workerScript = path.resolve(process.cwd(), 'dist/engine/terminalWorker.js');
      }
    } catch {
      workerScript = path.resolve(process.cwd(), 'dist/engine/terminalWorker.js');
    }

    if (process.platform === 'win32') {
      // In Windows, 'cmd.exe /c start' launches a visible console window without raw shell interpolation
      const child = spawn('cmd.exe', ['/c', 'start', 'TOAD Studio - Live Terminal', process.execPath, workerScript, targetCwd], {
        detached: true,
        stdio: 'ignore',
        cwd: targetCwd
      });
      child.unref();
    } else if (process.platform === 'darwin') {
      const safeScript = workerScript.replace(/["\\]/g, '\\$&');
      const safeCwd = targetCwd.replace(/["\\]/g, '\\$&');
      const safeExec = process.execPath.replace(/["\\]/g, '\\$&');
      spawn(
        'osascript',
        [
          '-e',
          `tell application "Terminal" to do script "\\"${safeExec}\\" \\"${safeScript}\\" \\"${safeCwd}\\""`
        ],
        { detached: true, stdio: 'ignore' }
      );
    } else {
      spawn('x-terminal-emulator', ['-e', process.execPath, workerScript, targetCwd], {
        detached: true,
        stdio: 'ignore'
      });
    }
  }

  // Write command to queue directory (FIFO) and legacy file
  const cmdFileName = `${Date.now()}_${process.hrtime.bigint()}.json`;
  const cmdFilePath = path.join(terminalQueueDir, cmdFileName);
  const payload = JSON.stringify({
    command,
    cwd: targetCwd,
    timestamp: Date.now()
  });
  fs.writeFileSync(cmdFilePath, payload, 'utf-8');
  try {
    fs.writeFileSync(queueFile, payload, 'utf-8');
  } catch {}

  return { success: true, reused: active };
}
