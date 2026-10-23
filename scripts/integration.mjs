import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
const port = Number(process.env.FOOTLAB_TEST_PORT || 55432);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Puerto de pruebas inválido');
const databaseDir = resolve(port === 55432 ? '.local/test-postgres' : `.local/test-postgres-${port}`);
if (!databaseDir.startsWith(resolve('.local') + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw new Error('Directorio de pruebas inválido');
mkdirSync(databaseDir, { recursive: true });
let databaseLog = '', started = false;
const pg = new EmbeddedPostgres({ databaseDir, user: 'footlab_test', password: 'local_test_only', port, persistent: true, authMethod: 'scram-sha-256', postgresFlags: ['-h', '127.0.0.1'], onLog: message => { databaseLog = (databaseLog + message).slice(-4000); }, onError: message => { console.error(message); } });
const env = { ...process.env, DATABASE_URL: `postgresql://footlab_test:local_test_only@127.0.0.1:${port}/footlab_test`, NODE_ENV: 'test', JWT_ACCESS_SECRET: randomBytes(48).toString('hex'), JWT_REFRESH_SECRET: randomBytes(48).toString('hex') };
const run = args => new Promise((resolve, reject) => { const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, { env, stdio: 'inherit', shell: process.platform === 'win32' }); child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Falló pnpm ${args.join(' ')}`))); });
try {
  if (!existsSync(resolve(databaseDir, 'PG_VERSION'))) await pg.initialise();
  console.log(`Iniciando PostgreSQL de pruebas en 127.0.0.1:${port}`);
  await pg.start(); started = true; const client = pg.getPgClient('postgres'); await client.connect();
  if (!(await client.query('SELECT 1 FROM pg_database WHERE datname=$1', ['footlab_test'])).rowCount) await pg.createDatabase('footlab_test'); await client.end();
  await run(['db:migrate:deploy']); await run(['--filter', '@footlab/api', 'test:integration']);
} catch (error) {
  process.exitCode = 1; console.error(error || 'No se pudo iniciar PostgreSQL de pruebas');
  if (!started) console.error(databaseLog);
} finally { if (started) await pg.stop(); }
