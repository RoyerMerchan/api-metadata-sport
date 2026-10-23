import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import * as argon2 from 'argon2';
import { ensureRoles } from '../src/modules/organizations/organizations.service';
config({ path: '../../.env', quiet: true });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const uid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed demo bloqueado en producción');
  if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 12) throw new Error('Configura SEED_PASSWORD de al menos 12 caracteres');
  await ensureRoles(db);
  const passwordHash = await argon2.hash(process.env.SEED_PASSWORD, { type: argon2.argon2id });
  const owner = await db.user.upsert({ where: { email: 'demo@footlab.local' }, update: {}, create: { id: uid(1), name: 'Alex Rivera', email: 'demo@footlab.local', passwordHash } });
  const viewer = await db.user.upsert({ where: { email: 'viewer@footlab.local' }, update: {}, create: { id: uid(2), name: 'Invitado Demo', email: 'viewer@footlab.local', passwordHash } });
  const org = await db.organization.upsert({ where: { id: uid(10) }, update: {}, create: { id: uid(10), name: 'Atlético Horizonte · DEMO', isDemo: true } });
  for (const [user, key] of [[owner, 'OWNER'], [viewer, 'VIEWER']] as const) {
    const role = await db.role.findUniqueOrThrow({ where: { key } });
    await db.organizationMember.upsert({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } }, create: { organizationId: org.id, userId: user.id, roleId: role.id }, update: {} });
  }
  await db.competition.upsert({ where: { id: uid(20) }, create: { id: uid(20), organizationId: org.id, name: 'Liga de desarrollo · DEMO', country: 'Venezuela', isDemo: true }, update: {} });
  await db.season.upsert({ where: { id: uid(21) }, create: { id: uid(21), competitionId: uid(20), name: '2026 · DEMO', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }, update: {} });
  for (const [n, name] of [[30, 'Horizonte FC'], [31, 'Academia Norte']] as const) await db.team.upsert({ where: { id: uid(n) }, create: { id: uid(n), organizationId: org.id, name, category: 'Sub-21', isDemo: true }, update: {} });
  for (const [n, name, position, team] of [[40, 'Mateo Silva', 'FW', 30], [41, 'Diego Rojas', 'MF', 30], [42, 'Lucas Méndez', 'FW', 31], [43, 'Samuel Torres', 'DF', 31]] as const) {
    await db.player.upsert({ where: { id: uid(n) }, create: { id: uid(n), organizationId: org.id, name, position, nationality: 'Venezuela', isDemo: true }, update: {} });
    await db.squadMembership.upsert({ where: { playerId_teamId_seasonId: { playerId: uid(n), teamId: uid(team), seasonId: uid(21) } }, create: { playerId: uid(n), teamId: uid(team), seasonId: uid(21), joinedAt: new Date('2026-01-01') }, update: {} });
  }
  for (const [n, date, homeScore, awayScore] of [[50, '2026-10-10T19:00:00Z', 1, 0], [51, '2026-10-17T19:00:00Z', 1, 1]] as const) {
    await db.match.upsert({ where: { id: uid(n) }, create: { id: uid(n), organizationId: org.id, seasonId: uid(21), homeTeamId: uid(30), awayTeamId: uid(31), kickoff: new Date(date), status: 'FINISHED', homeScore, awayScore, isDemo: true }, update: {} });
    for (const [p, team] of [[40, 30], [41, 30], [42, 31], [43, 31]] as const) await db.matchAppearance.upsert({ where: { matchId_playerId: { matchId: uid(n), playerId: uid(p) } }, create: { matchId: uid(n), playerId: uid(p), teamId: uid(team), starter: true, minutes: 90 }, update: {} });
  }
  for (const [n, match, player, team, minute] of [[60, 50, 40, 30, 32], [61, 51, 40, 30, 21], [62, 51, 42, 31, 70]] as const) await db.matchEvent.upsert({ where: { id: uid(n) }, create: { id: uid(n), matchId: uid(match), playerId: uid(player), teamId: uid(team), type: 'GOAL', minute }, update: {} });
  await db.staffMember.upsert({ where: { id: uid(70) }, create: { id: uid(70), teamId: uid(30), name: 'Elena Duarte', job: 'Entrenadora · DEMO' }, update: {} });
  console.log('Seed idempotente listo: demo@footlab.local y viewer@footlab.local. Contraseña: SEED_PASSWORD en tu .env. Datos ficticios identificados como DEMO.');
}
seed().finally(() => db.$disconnect());
