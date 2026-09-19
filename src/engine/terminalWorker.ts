/**
 * src/engine/terminalWorker.ts
 * Background worker process that stays alive in a dedicated CMD / Terminal window
 * to execute commands received from the TOAD Studio Dashboard.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';

const tmpDir = os.tmpdir();
const pidFile = path.join(tmpDir, 'toad_terminal.pid');
const queueFile = path.join(tmpDir, 'toad_terminal_cmd.json');

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
console.log('\x1b[32m\x1b[1m========================================================\x1b[0m\n');
console.log('\x1b[36m➜ Bereit.\x1b[0m Warten auf Befehle aus dem Dashboard...\n');

let isExecuting = false;

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
    stdio: 'inherit'
  });

  child.on('close', (code) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    if (code === 0) {
      console.log(`\n\x1b[32m\x1b[1m✔ Befehl erfolgreich abgeschlossen\x1b[0m \x1b[90m(${duration}s)\x1b[0m`);
    } else {
      console.log(`\n\x1b[31m\x1b[1m✖ Befehl beendet mit Code ${code}\x1b[0m \x1b[90m(${duration}s)\x1b[0m`);
    }
    console.log('\x1b[90m--------------------------------------------------------\x1b[0m');
    console.log('\x1b[36m➜ Warten auf nächsten Befehl aus dem Dashboard...\x1b[0m\n');
    isExecuting = false;
  });

  child.on('error', (err) => {
    console.error(`\x1b[31mFehler beim Ausführen des Befehls:\x1b[0m`, err.message || err);
    isExecuting = false;
  });
}

setInterval(checkQueue, 200);

process.on('exit', () => {
  try { fs.unlinkSync(pidFile); } catch {}
});
process.on('SIGINT', () => {
  try { fs.unlinkSync(pidFile); } catch {}
  process.exit(0);
});
process.on('SIGTERM', () => {
  try { fs.unlinkSync(pidFile); } catch {}
  process.exit(0);
});
