import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';
describe('API + PostgreSQL real + migraciones', () => {
  let app: INestApplication, db: PrismaService, token: string, refresh: string, user: any, org: string, otherOrg: string, viewerToken: string;
  let home: any, away: any, player: any, opponent: any, season: any, match: any;
  const prefix = '/api/v1'; const suffix = randomUUID(); const email = `owner-${suffix}@test.local`; const password = 'Test_password_12345';
  const call = () => request(app.getHttpServer());
  const get = (path: string, credential = token) => call().get(`${prefix}${path}`).auth(credential, { type: 'bearer' });
  const post = (path: string, body: any, credential = token) => call().post(`${prefix}${path}`).auth(credential, { type: 'bearer' }).send(body);
  const scope = (path: string, organization = org) => `${path}?organizationId=${organization}`;
  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || !new URL(process.env.DATABASE_URL!).pathname.includes('footlab_test')) throw new Error('Ejecutar mediante pnpm test:integration');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = module.createNestApplication({ logger: false, bodyParser: false }); configureApp(app); await app.init(); db = app.get(PrismaService);
  });
  afterAll(async () => { await app?.close(); });
  it('comprueba las migraciones aplicadas y healthcheck', async () => { expect((await get('/health', '')).body).toEqual({ status: 'ok' }); const migrations: any[] = await db.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL`; expect(migrations.length).toBeGreaterThanOrEqual(3); });
  it('expone contratos OpenAPI y oculta los errores críticos de conectividad', async () => {
    const spec = (await call().get('/api/docs-json')).body; expect(spec.paths['/api/v1/teams'].post.requestBody.content['application/json'].schema.properties.name.type).toBe('string');
    const spy = vi.spyOn(db, '$queryRaw').mockRejectedValueOnce(new Error('sensitive-database-host'));
    try { const r = await get('/health', ''); expect(r.status).toBe(503); expect(JSON.stringify(r.body)).not.toContain('sensitive-database-host'); } finally { spy.mockRestore(); }
  });
  it('registra y autentica con Argon2id sin exponer el hash', async () => { const r = await post('/auth/register', { email, password, name: 'Propietario Test' }, ''); expect(r.status).toBe(201); token = r.body.accessToken; refresh = r.body.refreshToken; user = r.body.user; expect(user.passwordHash).toBeUndefined(); expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash).toMatch(/^\$argon2id\$/); });
  it('rechaza contraseña incorrecta y valida DTO estricto', async () => { expect((await post('/auth/login', { email, password: 'incorrecta' }, '')).status).toBe(401); expect((await post('/auth/register', { email: 'a@b.c', password: 'short', name: 'x', globalRole: 'ADMIN' }, '')).status).toBe(400); });
  it('rechaza JSON mayor de 4 MB con HTTP 413 para Vercel Functions', async () => { const response = await post('/players', { name: 'x'.repeat(4 * 1024 * 1024) }); expect(response.status).toBe(413); expect(JSON.stringify(response.body)).not.toContain('stack'); });
  it('crea organizaciones independientes y rol OWNER', async () => { org = (await post('/organizations', { name: 'Club A' })).body.id; otherOrg = (await post('/organizations', { name: 'Club B' })).body.id; expect((await get('/organizations')).body).toHaveLength(2); });
  it('registra espectador y asigna permisos por organización', async () => { const emailViewer = `viewer-${suffix}@test.local`; viewerToken = (await post('/auth/register', { email: emailViewer, password, name: 'Visor Test' }, '')).body.accessToken; expect((await post(`/organizations/${org}/members`, { email: emailViewer, role: 'VIEWER' })).status).toBe(201); expect((await post(scope('/teams'), { name: 'Intrusión' }, viewerToken)).status).toBe(403); expect((await get(scope('/players', otherOrg), viewerToken)).status).toBe(404); });
  it('implementa CRUD deportivo persistido', async () => {
    home = (await post(scope('/teams'), { name: 'Local' })).body; away = (await post(scope('/teams'), { name: 'Visitante' })).body;
    player = (await post(scope('/players'), { name: 'Jugador Local', position: 'FW' })).body; opponent = (await post(scope('/players'), { name: 'Jugador Visitante', position: 'DF' })).body;
    expect(player.id).toBeTruthy(); const update = await call().patch(prefix + scope(`/players/${player.id}`)).auth(token, { type: 'bearer' }).send({ name: 'Jugador Editado' }); expect(update.status).toBe(200); expect((await get(scope(`/players/${player.id}`))).body.name).toBe('Jugador Editado');
    const competition = (await post(scope('/competitions'), { name: 'Liga Test' })).body;
    season = (await post(scope('/competitions/seasons'), { competitionId: competition.id, name: '2026', startDate: '2026-01-01', endDate: '2026-12-31' })).body;
    match = (await post(scope('/matches'), { homeTeamId: home.id, awayTeamId: away.id, seasonId: season.id, kickoff: '2026-10-10T19:00:00Z' })).body; expect(match.id).toBeTruthy();
    for (const [p, t] of [[player, home], [opponent, away]]) expect((await post(scope('/teams/squads'), { playerId: p.id, teamId: t.id, seasonId: season.id, joinedAt: '2026-01-01' })).status).toBe(201);
  });
  it('impide cruces entre organizaciones manipulando todos los identificadores', async () => {
    expect((await get(scope(`/players/${player.id}`, otherOrg))).status).toBe(404);
    expect((await call().patch(prefix + scope(`/players/${player.id}`, otherOrg)).auth(token, { type: 'bearer' }).send({ name: 'Ataque' })).status).toBe(404);
    expect((await post(scope('/matches', otherOrg), { homeTeamId: home.id, awayTeamId: away.id, seasonId: season.id, kickoff: '2026-10-10T19:00:00Z' })).status).toBe(404);
    expect((await get(scope(`/statistics/players/${player.id}`, otherOrg))).status).toBe(404);
    expect((await post(scope('/teams/squads', otherOrg), { playerId: player.id, teamId: home.id, seasonId: season.id, joinedAt: '2026-01-01' })).status).toBe(404);
  });
  it('no permite acceso público a registros privados ni escritura sin organización', async () => { expect((await get(`/players/${player.id}`)).status).toBe(404); expect((await post('/teams', { name: 'Sin organización' })).status).toBe(400); expect((await call().get(prefix + '/players')).status).toBe(401); });
  it('valida convocatoria antes de eventos y limita titulares', async () => {
    expect((await post(scope('/match-events'), { matchId: match.id, teamId: home.id, playerId: player.id, type: 'GOAL', minute: 20 })).status).toBe(400);
    const put = await call().put(prefix + scope(`/matches/${match.id}/lineup`)).auth(token, { type: 'bearer' }).send({ teamId: home.id, formation: '4-3-3', appearances: [{ playerId: player.id, teamId: home.id, minutes: 60, starter: true }] }); expect(put.status).toBe(200);
    expect((await post(scope('/match-events'), { matchId: match.id, teamId: home.id, playerId: player.id, type: 'GOAL', minute: 20 })).status).toBe(201);
    expect((await call().patch(prefix + scope(`/matches/${match.id}/result`)).auth(token, { type: 'bearer' }).send({ status: 'FINISHED', homeScore: 1, awayScore: 0 })).status).toBe(200);
  });
  it('calcula totales, por 90, evolución y clasificación sin asistencias inventadas', async () => {
    const stats = (await get(scope(`/statistics/players/${player.id}`))).body; expect(stats.minutes).toBe(60); expect(stats.goals).toBe(1); expect(stats.goalsPer90).toBe(1.5); expect(stats.assists).toBeNull(); expect(stats.evolution).toHaveLength(1);
    const comparison = await get(`/comparisons?organizationId=${org}&left=${player.id}&right=${opponent.id}`); expect(comparison.status).toBe(200); expect(comparison.body.right.available).toBe(false); expect(comparison.body.right.goals).toBeNull();
    const table = (await get(scope('/statistics/standings') + `&seasonId=${season.id}`)).body.items; expect(table[0].id).toBe(home.id); expect(table[0].points).toBe(3);
  });
  it('guarda favoritos y evaluaciones con autorización', async () => { expect((await post('/favorites', { playerId: player.id })).status).toBe(201); expect((await get('/favorites')).body).toHaveLength(1); expect((await post(scope('/players/evaluations'), { playerId: player.id, seasonId: season.id, rating: 8, notes: 'Buen desempeño' })).status).toBe(201); expect((await get(scope(`/players/${player.id}/evaluations`))).body).toHaveLength(1); });
  it('separa permisos globales de los roles de club', async () => { expect((await post('/integrations/football-data/sync', { competition: 'PL', season: 2026 })).status).toBe(403); });
  it('importa fixtures StatsBomb de forma idempotente y conserva la cobertura original', async () => {
    await db.user.update({ where: { id: user.id }, data: { globalRole: 'ADMIN' } });
    try {
      const payload = {
        match: { match_id: 900001, match_date: '2026-10-01', kick_off: '20:00:00.000', home_score: 1, away_score: 0, competition: { competition_id: 900002, competition_name: 'Fixture de pruebas' }, season: { season_id: 900003, season_name: '2026' }, home_team: { home_team_id: 900004, home_team_name: 'Fixture Local' }, away_team: { away_team_id: 900005, away_team_name: 'Fixture Visitante' } },
        lineups: [{ team_id: 900004, team_name: 'Fixture Local', lineup: [{ player_id: 900006, player_name: 'Fixture Delantero', positions: [{ position_id: 23, from: '00:00', to: '90:00' }] }] }, { team_id: 900005, team_name: 'Fixture Visitante', lineup: [{ player_id: 900007, player_name: 'Fixture Defensa', positions: [{ position_id: 3, from: '00:00', to: '90:00' }] }] }],
        events: [{ id: 'fixture-event-1', type: { name: 'Shot' }, minute: 20, team: { id: 900004 }, player: { id: 900006 }, shot: { outcome: { name: 'Goal' } } }],
      };
      const first = await post('/integrations/statsbomb/import', payload); expect(first.status).toBe(201);
      const second = await post('/integrations/statsbomb/import', payload); expect(second.body.matchId).toBe(first.body.matchId);
      const saved = await db.match.findUniqueOrThrow({ where: { id: first.body.matchId }, include: { events: true, appearances: true, season: true } });
      expect(saved.events).toHaveLength(1); expect(saved.appearances).toHaveLength(2); expect(saved.kickoffTimezoneKnown).toBe(false); expect(saved.season.datesAreCoverage).toBe(true); expect(saved.season.startDate.toISOString().slice(0, 10)).toBe('2026-10-01');
    } finally { await db.user.update({ where: { id: user.id }, data: { globalRole: 'USER' } }); }
  });
  it('normaliza football-data con HTTP simulado y PostgreSQL real sin inventar estadísticas', async () => {
    await db.user.update({ where: { id: user.id }, data: { globalRole: 'ADMIN' } });
    const previous = process.env.FOOTBALL_DATA_TOKEN; process.env.FOOTBALL_DATA_TOKEN = 'test-fixture-token';
    const mock = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);
      const data = url.includes('/teams?') ? { teams: [{ id: 910002, name: 'Fixture A', squad: [{ id: 910005, name: 'Fixture Jugador', position: null }] }, { id: 910003, name: 'Fixture B', squad: [] }] } : url.includes('/matches?') ? { matches: [{ id: 910004, utcDate: '2026-10-01T20:00:00Z', status: 'FINISHED', homeTeam: { id: 910002 }, awayTeam: { id: 910003 }, season: { startDate: '2026-01-01', endDate: '2026-12-31' }, score: { fullTime: { home: 2, away: 0 } } }] } : { id: 910001, name: 'Fixture de proveedor' };
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    try {
      const first = await post('/integrations/football-data/sync', { competition: 'TEST', season: 2026 }); expect(first.status).toBe(201); expect(first.body.matches).toBe(1);
      const second = await post('/integrations/football-data/sync', { competition: 'TEST', season: 2026 }); expect(second.body.seasonId).toBe(first.body.seasonId);
      const p = await db.player.findFirstOrThrow({ where: { name: 'Fixture Jugador', source: 'FOOTBALL_DATA' } }); expect(p.position).toBe('UNKNOWN'); const stats = (await get(`/statistics/players/${p.id}`)).body; expect(stats.available).toBe(false); expect(stats.goals).toBeNull();
    } finally { mock.mockRestore(); if (previous === undefined) delete process.env.FOOTBALL_DATA_TOKEN; else process.env.FOOTBALL_DATA_TOKEN = previous; await db.user.update({ where: { id: user.id }, data: { globalRole: 'USER' } }); }
  });
  it('mantiene propietario y evita que DIRECTOR eleve OWNER', async () => { expect((await post(`/organizations/${org}/members`, { email, role: 'VIEWER' })).status).toBe(409); });
  it('rota refresh token y revoca ante reutilización', async () => { const rotated = await post('/auth/refresh', { refreshToken: refresh }, ''); expect(rotated.status).toBe(201); expect(rotated.body.refreshToken).not.toBe(refresh); expect((await post('/auth/refresh', { refreshToken: refresh }, '')).status).toBe(401); expect((await get('/users/me', rotated.body.accessToken)).status).toBe(401); });
  it('login y logout revocan el acceso inmediatamente', async () => { const login = await post('/auth/login', { email, password }, ''); token = login.body.accessToken; expect((await get('/users/me')).status).toBe(200); expect((await post('/auth/logout', {})).status).toBe(201); expect((await get('/users/me')).status).toBe(401); });
  it('restablece contraseña una sola vez y revoca todas las sesiones', async () => {
    const login = await post('/auth/login', { email, password }, ''); const resetToken = randomBytes(32).toString('hex');
    await db.passwordReset.create({ data: { userId: user.id, tokenHash: createHash('sha256').update(resetToken).digest('hex'), expiresAt: new Date(Date.now() + 60000) } });
    expect((await post('/auth/reset-password', { token: resetToken, password: 'New_password_12345' }, '')).status).toBe(201); expect((await get('/users/me', login.body.accessToken)).status).toBe(401); expect((await post('/auth/reset-password', { token: resetToken, password }, '')).status).toBe(400);
  });
  it('protege restricciones SQL independientemente de la API', async () => { await expect(db.matchAppearance.create({ data: { matchId: match.id, playerId: opponent.id, teamId: away.id, minutes: -1, starter: false } })).rejects.toThrow(); });
});
