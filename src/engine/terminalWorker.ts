/**
 * src/engine/terminalWorker.ts
 * Background worker process that stays alive in a dedicated CMD / Terminal window
 * to execute commands received from the TOAD Studio Dashboard.
 * Supports instant cancellation via Ctrl+C and cancellation file.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';
import { spawn, ChildProcess } from 'node:child_process';

const userKey = (process.env.USER || process.env.USERNAME || 'toad_user').replace(/[^a-zA-Z0-9_-]/g, '_');
const toadTerminalDir = path.join(os.tmpdir(), `toad_term_${userKey}`);
if (!fs.existsSync(toadTerminalDir)) {
  try {
    fs.mkdirSync(toadTerminalDir, { recursive: true, mode: 0o700 });
  } catch {}
}
const pidFile = path.join(toadTerminalDir, 'toad_terminal.pid');
const queueFile = path.join(toadTerminalDir, 'toad_terminal_cmd.json');
const cancelFile = path.join(toadTerminalDir, 'toad_terminal_cancel.flag');
const childPidFile = path.join(toadTerminalDir, 'toad_terminal_child.pid');

// Write worker PID so server knows this window is active
try {
  fs.writeFileSync(pidFile, String(process.pid), 'utf-8');
} catch {}

if (process.platform === 'win32') {
  try {
    process.title = 'TOAD Studio - Live Terminal';
  } catch {}
}

console.clear();
console.log('\x1b[32m\x1b[1m========================================================\x1b[0m');
console.log('\x1b[32m\x1b[1m  🐸 TOAD Studio — Live Terminal\x1b[0m');
console.log('\x1b[90m  Befehle aus dem Web-Dashboard werden hier ausgeführt.\x1b[0m');
console.log('\x1b[90m  Dieses Fenster bleibt für nachfolgende Befehle aktiv.\x1b[0m');
console.log('\x1b[90m  Laufende Befehle können mit Strg+C jederzeit abgebrochen werden.\x1b[0m');
console.log('\x1b[32m\x1b[1m========================================================\x1b[0m\n');
console.log('\x1b[36m➜ Bereit.\x1b[0m Warten auf Befehle aus dem Dashboard...\n');

let isExecuting = false;
let currentChild: ChildProcess | null = null;

function abortCurrentCommand(): boolean {
  if (isExecuting && currentChild) {
    const childRef = currentChild;
    const pid = childRef.pid;
    isExecuting = false;
    currentChild = null;

    if (pid) {
      if (process.platform === 'win32') {
        try {
          // /T kills the entire process tree, /F forces immediate termination
          spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
        } catch {}
      } else {
        try {
          process.kill(-pid, 'SIGINT');
        } catch {
          try {
            childRef.kill('SIGINT');
          } catch {}
        }
      }
    }

    try { fs.unlinkSync(childPidFile); } catch {}

    console.log('\n\x1b[33m\x1b[1m⚠ Vorgang durch Benutzer mit Strg+C abgebrochen.\x1b[0m');
    console.log('\x1b[90m--------------------------------------------------------\x1b[0m');
    console.log('\x1b[36m➜ Bereit.\x1b[0m Warten auf nächsten Befehl aus dem Dashboard...\n');
    return true;
  }
  return false;
}

// Windows requires readline on stdin to capture Ctrl+C (SIGINT) reliably
if (process.platform === 'win32') {
  try {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('SIGINT', () => {
      process.emit('SIGINT');
    });
  } catch {}
}

async function checkQueue() {
  if (isExecuting) return;
  if (!fs.existsSync(queueFile)) return;

  let cmdData: { command: string; cwd?: string } | null = null;
  try {
    const content = fs.readFileSync(queueFile, 'utf-8');
    fs.unlinkSync(queueFile);
    cmdData = JSON.parse(content);
  } catch {
    return;
  }

  if (!cmdData || !cmdData.command) return;

  isExecuting = true;
  const cmdStr = cmdData.command;
  const targetCwd = cmdData.cwd || process.cwd();

  console.log('\x1b[36m--------------------------------------------------------\x1b[0m');
  console.log(`\x1b[1m\x1b[37m➜ Führe aus:\x1b[0m \x1b[33m${cmdStr}\x1b[0m`);
  if (targetCwd) {
    console.log(`\x1b[90m  Arbeitsverzeichnis: ${targetCwd}\x1b[0m`);
  }
  console.log('\x1b[36m--------------------------------------------------------\x1b[0m\n');

  const startTime = Date.now();
  const child = spawn(cmdStr, {
    cwd: targetCwd,
    shell: true,
    stdio: 'inherit',
    detached: process.platform !== 'win32'
  });
  currentChild = child;

  try {
    if (child.pid) {
      fs.writeFileSync(childPidFile, String(child.pid), 'utf-8');
    }
  } catch {}

  child.on('close', (code) => {
    try { fs.unlinkSync(childPidFile); } catch {}
    currentChild = null;

    if (!isExecuting) {
      // Already aborted
      return;
    }
    isExecuting = false;

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    if (code === 0) {
      console.log(`\n\x1b[32m\x1b[1m✔ Befehl erfolgreich abgeschlossen\x1b[0m \x1b[90m(${duration}s)\x1b[0m`);
    } else {
      console.log(`\n\x1b[31m\x1b[1m✖ Befehl beendet mit Code ${code}\x1b[0m \x1b[90m(${duration}s)\x1b[0m`);
    }
    console.log('\x1b[90m--------------------------------------------------------\x1b[0m');
    console.log('\x1b[36m➜ Bereit.\x1b[0m Warten auf nächsten Befehl aus dem Dashboard...\n');
  });

  child.on('error', (err) => {
    try { fs.unlinkSync(childPidFile); } catch {}
    currentChild = null;
    if (!isExecuting) return;
    isExecuting = false;

    console.error(`\x1b[31mFehler beim Ausführen des Befehls:\x1b[0m`, err.message || err);
  });
}

function checkCancel() {
  if (fs.existsSync(cancelFile)) {
    try { fs.unlinkSync(cancelFile); } catch {}
    abortCurrentCommand();
  }
}

setInterval(checkQueue, 200);
setInterval(checkCancel, 150);

process.on('SIGINT', () => {
  if (!abortCurrentCommand()) {
    try { fs.unlinkSync(pidFile); } catch {}
    try { fs.unlinkSync(childPidFile); } catch {}
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  if (!abortCurrentCommand()) {
    try { fs.unlinkSync(pidFile); } catch {}
    try { fs.unlinkSync(childPidFile); } catch {}
    process.exit(0);
  }
});

process.on('exit', () => {
  try { fs.unlinkSync(pidFile); } catch {}
  try { fs.unlinkSync(childPidFile); } catch {}
});
