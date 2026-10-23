import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!existsSync('.env')) {
  const text = readFileSync('.env.example', 'utf8').replace('replace_with_at_least_32_random_characters', randomBytes(48).toString('hex')).replace('replace_with_different_32_random_characters', randomBytes(48).toString('hex')).replace('Choose_a_local_demo_password_123', randomBytes(18).toString('base64url'));
  writeFileSync('.env', text); console.log('.env creado con secretos aleatorios. La contraseña demo está en SEED_PASSWORD.');
} else console.log('.env existente conservado.');
if (!existsSync('apps/mobile/.env')) writeFileSync('apps/mobile/.env', readFileSync('apps/mobile/.env.example'));
