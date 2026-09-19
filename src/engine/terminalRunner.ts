/**
 * src/engine/terminalRunner.ts
 * Manages dispatching commands to a persistent, reusable CMD / Terminal window.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tmpDir = os.tmpdir();
const pidFile = path.join(tmpDir, 'toad_terminal.pid');
const queueFile = path.join(tmpDir, 'toad_terminal_cmd.json');

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
      // In Windows, 'start' launches a visible, detached console window
      const startCmd = `start "TOAD Studio - Live Terminal" "${process.execPath}" "${workerScript}" "${targetCwd}"`;
      const child = spawn(startCmd, {
        shell: true,
        detached: true,
        stdio: 'ignore',
        cwd: targetCwd
      });
      child.unref();
    } else if (process.platform === 'darwin') {
      spawn(
        'osascript',
        [
          '-e',
          `tell application "Terminal" to do script "${process.execPath} \\"${workerScript}\\" \\"${targetCwd}\\""`
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

  // Write command to queue file for the worker to execute
  fs.writeFileSync(
    queueFile,
    JSON.stringify({
      command,
      cwd: targetCwd,
      timestamp: Date.now()
    }),
    'utf-8'
  );

  return { success: true, reused: active };
}
