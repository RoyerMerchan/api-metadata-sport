import 'reflect-metadata';
import './config/env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
async function main() { const app = await NestFactory.create(AppModule, { bodyParser: false }); const env = configureApp(app); await app.listen(env.PORT, '0.0.0.0'); }
main().catch(() => { console.error('No se pudo iniciar FOOTLAB. Revisa la configuración y la conexión PostgreSQL.'); process.exitCode = 1; });
