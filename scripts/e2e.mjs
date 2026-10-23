import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const cache = resolve('.cache/playwright');
const env = { ...process.env, ...(existsSync(cache) && !process.env.PLAYWRIGHT_BROWSERS_PATH ? { PLAYWRIGHT_BROWSERS_PATH: cache } : {}) };
const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--filter', '@footlab/mobile', 'exec', 'playwright', 'test'], { env, stdio: 'inherit', shell: process.platform === 'win32' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
