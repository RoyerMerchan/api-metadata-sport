import '../src/config/env';
import { PrismaService } from '../src/database/prisma.service';
const email = process.argv[2];
if (!email?.includes('@')) throw new Error('Uso: pnpm --filter @footlab/api admin:grant usuario@dominio');
const db = new PrismaService();
try { const user = await db.user.update({ where: { email: email.toLowerCase() }, data: { globalRole: 'ADMIN' }, select: { email: true } }); console.log(`Administrador global: ${user.email}`); } finally { await db.$disconnect(); }
