import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv[2];
if (!['api', 'web'].includes(target)) throw new Error('Indica api o web');
config({ path: new URL('../.env', import.meta.url), quiet: true });
if (target === 'api' && !process.env.DATABASE_URL) throw new Error('Configura DATABASE_URL en el proyecto API de Vercel');
if (target === 'web' && process.env.VERCEL === '1') {
  let url;
  try { url = new URL(process.env.VITE_API_URL); } catch { throw new Error('Configura VITE_API_URL con la URL HTTPS de tu API y el sufijo /api/v1'); }
  if (url.protocol !== 'https:' || !url.pathname.endsWith('/api/v1') || /localhost|10\.0\.2\.2|TU_API/i.test(url.hostname)) throw new Error('VITE_API_URL debe apuntar a tu API pública HTTPS con el sufijo /api/v1');
}
process.env.NODE_ENV = 'production';
const run = args => new Promise((resolve, reject) => {
  const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, { cwd: root, env: process.env, stdio: 'inherit', shell: process.platform === 'win32' });
  child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Falló pnpm ${args.join(' ')}`)));
});
if (target === 'api') await run(['db:generate']);
await run(['--filter', '@footlab/shared', 'build']);
await run(['--filter', target === 'api' ? '@footlab/api' : '@footlab/mobile', 'build']);
// Never migrate on a function cold start. A failed migration fails the deployment build.
if (target === 'api') await run(['db:migrate:deploy']);
