import { spawn } from 'node:child_process';

/**
 * Strips ANSI escape sequences (colors, styles, cursor codes) from text.
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
}

/**
 * Copies text to system clipboard across Windows, macOS, and Linux without external dependencies.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const clean = stripAnsi(text);

  return new Promise<boolean>((resolve) => {
    let proc: ReturnType<typeof spawn> | null = null;

    try {
      if (process.platform === 'win32') {
        proc = spawn('clip');
      } else if (process.platform === 'darwin') {
        proc = spawn('pbcopy');
      } else {
        if (process.env.WAYLAND_DISPLAY) {
          proc = spawn('wl-copy');
        } else {
          proc = spawn('xclip', ['-selection', 'clipboard']);
        }
      }
    } catch {
      proc = null;
    }

    if (!proc) {
      if (process.stdout.isTTY) {
        try {
          process.stdout.write(`\x1b]52;c;${Buffer.from(clean).toString('base64')}\x07`);
          resolve(true);
          return;
        } catch {
          // ignore
        }
      }
      resolve(false);
      return;
    }

    let resolved = false;
    const safeResolve = (val: boolean) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };

    proc.on('error', () => {
      if (process.stdout.isTTY) {
        try {
          process.stdout.write(`\x1b]52;c;${Buffer.from(clean).toString('base64')}\x07`);
          safeResolve(true);
          return;
        } catch {
          // ignore
        }
      }
      safeResolve(false);
    });

    proc.on('close', (code) => {
      safeResolve(code === 0);
    });

    try {
      if (proc.stdin) {
        if (process.platform === 'win32') {
          // Windows clip.exe natively requires UTF-16LE for Unicode/UTF-8 characters (box drawing, umlauts, symbols)
          proc.stdin.write(Buffer.from(clean, 'utf16le'));
        } else {
          proc.stdin.write(clean);
        }
        proc.stdin.end();
      } else {
        safeResolve(false);
      }
    } catch {
      safeResolve(false);
    }
  });
}
