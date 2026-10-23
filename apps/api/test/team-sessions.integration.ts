import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/database/prisma.service';

describe('Equipos privados, invitaciones y sesiones independientes', () => {
  let app: INestApplication, db: PrismaService;
  let owner: any, other: any, member: any, outsider: any, second: any, memberSecond: any;
  let org: string, otherOrg: string, secondOrg: string, player: any;
  const suffix = randomUUID(), password = 'Team_sessions_12345';
  const email = (name: string) => `${name}-${suffix}@test.local`;
  const call = (method: 'get' | 'post' | 'delete', path: string, credential?: string, body?: any) => request(app.getHttpServer())[method](`/api/v1${path}`).auth(credential ?? '', { type: 'bearer' }).send(body);
  const invite = (role = 'COACH', target = member.user.email) => call('post', `/organizations/${org}/invitations`, owner.accessToken, { email: target, role });
  const accept = (token: string, account = member) => call('post', '/organizations/invitations/accept', account.accessToken, { token });
  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || !new URL(process.env.DATABASE_URL!).pathname.includes('footlab_test')) throw new Error('Ejecutar mediante pnpm test:integration');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = module.createNestApplication({ logger: false, bodyParser: false }); configureApp(app); await app.init(); db = app.get(PrismaService);
    for (const name of ['owner', 'other', 'member', 'outsider']) {
      const response = await call('post', '/auth/register', '', { email: email(name), name: `Cuenta ${name}`, password, ...(['owner', 'other'].includes(name) ? { organizationName: `Equipo ${name}` } : {}) });
      expect(response.status).toBe(201);
      if (name === 'owner') owner = response.body; else if (name === 'other') other = response.body; else if (name === 'member') member = response.body; else outsider = response.body;
    }
    org = owner.session.activeOrganizationId; otherOrg = other.session.activeOrganizationId;
  });
  afterAll(async () => { await app?.close(); });

  it('registra propietario, equipo inicial y espacio privado en una transacción', async () => {
    expect(org).toBeTruthy(); expect(org).not.toBe(otherOrg); expect(member.session.activeOrganizationId).toBeNull();
    const memberships = (await call('get', '/organizations', owner.accessToken)).body;
    expect(memberships).toHaveLength(1); expect(memberships[0].role.key).toBe('OWNER');
    const teams = (await call('get', `/teams?organizationId=${org}`, owner.accessToken)).body.items;
    expect(teams).toHaveLength(1); expect(teams[0].name).toBe('Equipo owner');
    expect((await call('get', '/auth/session', owner.accessToken)).body.activeOrganizationId).toBe(org);
  });
  it('separa las listas, detalles y escrituras de dos equipos con sesiones simultáneas', async () => {
    player = (await call('post', `/players?organizationId=${org}`, owner.accessToken, { name: 'Jugador privado A', position: 'MF' })).body;
    expect(player.id).toBeTruthy();
    expect((await call('get', `/players?organizationId=${otherOrg}`, other.accessToken)).body.items).toHaveLength(0);
    expect((await call('get', `/players?organizationId=${org}`, other.accessToken)).status).toBe(404);
    expect((await call('get', `/players/${player.id}?organizationId=${otherOrg}`, other.accessToken)).status).toBe(404);
    expect((await call('delete', `/players/${player.id}?organizationId=${org}`, other.accessToken)).status).toBe(404);
    expect((await call('get', `/players/${player.id}`, other.accessToken)).status).toBe(404);
  });
  it('cada dispositivo conserva su equipo activo, también al renovar tokens', async () => {
    second = (await call('post', '/auth/login', '', { email: owner.user.email, password })).body;
    expect(second.session.id).not.toBe(owner.session.id); expect(second.session.activeOrganizationId).toBe(org);
    const created = await call('post', '/organizations', owner.accessToken, { name: 'Segundo club del propietario' }); expect(created.status).toBe(201); secondOrg = created.body.id;
    expect((await call('get', '/auth/session', owner.accessToken)).body.activeOrganizationId).toBe(secondOrg);
    expect((await call('get', '/auth/session', second.accessToken)).body.activeOrganizationId).toBe(org);
    expect((await call('post', '/auth/session/workspace', second.accessToken, { organizationId: otherOrg })).status).toBe(404);
    expect((await call('get', '/auth/session', second.accessToken)).status).toBe(200);
    const refreshed = await call('post', '/auth/refresh', '', { refreshToken: owner.refreshToken }); expect(refreshed.status).toBe(201); owner = refreshed.body;
    expect(owner.session.activeOrganizationId).toBe(secondOrg);
    expect((await call('post', '/auth/session/workspace', owner.accessToken, { organizationId: org })).status).toBe(201);
  });
  it('las invitaciones están ligadas al correo y se muestran una sola vez', async () => {
    const response = await invite(); expect(response.status).toBe(201); const invitation = response.body;
    expect(invitation.token).toMatch(/^[a-f0-9]{64}$/); expect(invitation.tokenHash).toBeUndefined();
    const pending = await call('get', `/organizations/${org}/invitations`, owner.accessToken);
    expect(pending.body.find((i: any) => i.id === invitation.id)).toBeTruthy(); expect(JSON.stringify(pending.body)).not.toContain(invitation.token);
    expect((await accept(invitation.token, outsider)).status).toBe(400);
    expect((await accept(invitation.token)).status).toBe(201);
    expect((await accept(invitation.token)).status).toBe(400);
    expect((await call('get', '/auth/session', member.accessToken)).body.activeOrganizationId).toBe(org);
    expect((await call('get', `/players?organizationId=${org}`, member.accessToken)).body.items[0].id).toBe(player.id);
    expect((await call('post', `/players?organizationId=${org}`, member.accessToken, { name: 'Jugador del entrenador', position: 'DF' })).status).toBe(201);
    expect((await invite('OWNER')).status).toBe(400);
    expect((await call('get', `/organizations/${org}/invitations`, member.accessToken)).status).toBe(403);
  });
  it('rechaza invitaciones revocadas, caducadas y emitidas sin permiso vigente', async () => {
    const revoked = (await invite()).body;
    expect((await call('delete', `/organizations/${org}/invitations/${revoked.id}`, owner.accessToken)).status).toBe(200);
    expect((await accept(revoked.token)).status).toBe(400);
    const expired = (await invite()).body; await db.organizationInvitation.update({ where: { id: expired.id }, data: { expiresAt: new Date(0) } });
    expect((await accept(expired.token)).status).toBe(400);
    await call('post', `/organizations/${org}/members`, owner.accessToken, { email: member.user.email, role: 'DIRECTOR' });
    const issued = (await call('post', `/organizations/${org}/invitations`, member.accessToken, { email: outsider.user.email, role: 'VIEWER' })).body;
    await call('post', `/organizations/${org}/members`, owner.accessToken, { email: member.user.email, role: 'COACH' });
    expect((await accept(issued.token, outsider)).status).toBe(400);
  });
  it('permite un solo canje concurrente y conserva el rol de un miembro existente', async () => {
    const invitation = (await invite('VIEWER')).body;
    const results = await Promise.all([accept(invitation.token), accept(invitation.token)]);
    expect(results.map(r => r.status).sort()).toEqual([201, 400]);
    const membership = await db.organizationMember.findUniqueOrThrow({ where: { organizationId_userId: { organizationId: org, userId: member.user.id } }, include: { role: true } }); expect(membership.role.key).toBe('COACH');
    const ownInvite = (await invite('VIEWER', owner.user.email)).body; expect((await accept(ownInvite.token, owner)).status).toBe(201);
    expect((await call('get', '/organizations', owner.accessToken)).body.find((m: any) => m.organization.id === org).role.key).toBe('OWNER');
  });
  it('el rol de lectura no puede modificar datos deportivos', async () => {
    const invitation = (await invite('VIEWER', outsider.user.email)).body; expect((await accept(invitation.token, outsider)).status).toBe(201);
    expect((await call('get', `/players?organizationId=${org}`, outsider.accessToken)).status).toBe(200);
    expect((await call('post', `/players?organizationId=${org}`, outsider.accessToken, { name: 'No autorizado', position: 'FW' })).status).toBe(403);
  });
  it('retirar a un miembro elimina el acceso y limpia el equipo activo de sus dispositivos', async () => {
    memberSecond = (await call('post', '/auth/login', '', { email: member.user.email, password })).body;
    expect((await call('delete', `/organizations/${org}/members/${owner.user.id}`, owner.accessToken)).status).toBe(409);
    expect((await call('delete', `/organizations/${org}/members/${member.user.id}`, owner.accessToken)).status).toBe(200);
    for (const account of [member, memberSecond]) {
      expect((await call('get', '/auth/session', account.accessToken)).body.activeOrganizationId).toBeNull();
      expect((await call('get', `/players?organizationId=${org}`, account.accessToken)).status).toBe(404);
      expect((await call('get', '/organizations', account.accessToken)).body).toHaveLength(0);
    }
    expect((await call('get', `/players?organizationId=${otherOrg}`, other.accessToken)).status).toBe(200);
  });
  it('cierra las otras sesiones de la cuenta sin afectar a otro equipo ni al dispositivo actual', async () => {
    const response = await call('post', '/auth/sessions/revoke-others', owner.accessToken, {}); expect(response.status).toBe(201); expect(response.body.revoked).toBe(1);
    expect((await call('get', '/auth/session', second.accessToken)).status).toBe(401);
    expect((await call('get', '/auth/session', owner.accessToken)).status).toBe(200);
    expect((await call('get', '/auth/session', other.accessToken)).status).toBe(200);
    expect((await call('post', '/auth/logout', owner.accessToken, {})).status).toBe(201);
    expect((await call('get', '/auth/session', owner.accessToken)).status).toBe(401);
    expect((await call('get', '/auth/session', other.accessToken)).status).toBe(200);
  });
});
