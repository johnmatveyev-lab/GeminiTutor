import { spawn } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const viteBin = process.platform === 'win32'
  ? join('node_modules', '.bin', 'vite.cmd')
  : join('node_modules', '.bin', 'vite');

const processes = [
  spawn(process.execPath, ['server/browserControlServer.mjs'], {
    stdio: 'inherit'
  }),
  spawn(viteBin, args, {
    stdio: 'inherit'
  })
];

const shutdown = (code = 0) => {
  for (const child of processes) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
};

for (const child of processes) {
  child.on('exit', (code) => {
    if (code && code !== 0) shutdown(code);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
