import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';
import type { Principal } from '../../common/auth';
import { ensureRoles } from '../organizations/organizations.service';
const digest = (v: string) => createHash('sha256').update(v).digest('hex');
const safeUser = (u: { id: string; name: string; email: string; globalRole: string }) => ({ id: u.id, name: u.name, email: u.email, globalRole: u.globalRole });
@Injectable()
export class AuthService {
  private dummy = argon2.hash(randomBytes(32), { type: argon2.argon2id });
  constructor(@Inject(PrismaService) private db: PrismaService, @Inject(JwtService) private jwt: JwtService) {}
  async register(input: { email: string; name: string; password: string; organizationName?: string }, userAgent?: string) {
    if (input.organizationName) await ensureRoles(this.db);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    return this.db.$transaction(async tx => {
      const user = await tx.user.create({ data: { email: input.email, name: input.name, passwordHash } });
      let organizationId: string | null = null;
      if (input.organizationName) {
        const role = await tx.role.findUniqueOrThrow({ where: { key: 'OWNER' } });
        const org = await tx.organization.create({ data: { name: input.organizationName, members: { create: { userId: user.id, roleId: role.id } }, teams: { create: { name: input.organizationName } }, audits: { create: { actorId: user.id, action: 'organization.register', entityId: user.id } } } });
        organizationId = org.id;
      }
      return this.newSession(user, userAgent, tx, organizationId);
    });
  }
  async login(input: { email: string; password: string }, userAgent?: string) {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    const ok = await argon2.verify(user?.passwordHash ?? await this.dummy, input.password);
    if (!user || !ok) throw new UnauthorizedException('Correo o contraseña incorrectos');
    return this.newSession(user, userAgent);
  }
  private async tokens(userId: string, sessionId: string) {
    const base = { sub: userId, sid: sessionId };
    return {
      accessToken: await this.jwt.signAsync({ ...base, type: 'access' }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m', issuer: 'footlab', audience: 'footlab-app', algorithm: 'HS256' }),
      refreshToken: await this.jwt.signAsync({ ...base, type: 'refresh', jti: randomUUID() }, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '30d', issuer: 'footlab', audience: 'footlab-app', algorithm: 'HS256' }),
    };
  }
  private async newSession(user: { id: string; name: string; email: string; globalRole: string }, userAgent?: string, db: any = this.db, organizationId?: string | null) {
    const sid = randomUUID(); const tokens = await this.tokens(user.id, sid);
    const member = organizationId === undefined ? await db.organizationMember.findFirst({ where: { userId: user.id }, orderBy: { organization: { createdAt: 'asc' } } }) : null;
    const session = await db.session.create({ data: { id: sid, userId: user.id, activeOrganizationId: organizationId ?? member?.organizationId ?? null, refreshHash: digest(tokens.refreshToken), expiresAt: new Date(Date.now() + 30 * 86400000), userAgent: userAgent?.slice(0, 250) } });
    return { ...tokens, user: safeUser(user), session: { id: session.id, activeOrganizationId: session.activeOrganizationId } };
  }
  async refresh(token: string) {
    let claims: any;
    try { claims = await this.jwt.verifyAsync(token, { secret: process.env.JWT_REFRESH_SECRET, algorithms: ['HS256'], issuer: 'footlab', audience: 'footlab-app' }); } catch { throw new UnauthorizedException(); }
    if (claims.type !== 'refresh') throw new UnauthorizedException();
    const session = await this.db.session.findFirst({ where: { id: claims.sid, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
    if (!session) throw new UnauthorizedException();
    const hash = digest(token);
    if (session.refreshHash !== hash) { await this.db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } }); throw new UnauthorizedException('Reutilización de refresh token; vuelve a entrar'); }
    const tokens = await this.tokens(session.userId, session.id);
    const claimed = await this.db.session.updateMany({ where: { id: session.id, refreshHash: hash, revokedAt: null }, data: { previousHash: hash, refreshHash: digest(tokens.refreshToken) } });
    if (!claimed.count) throw new UnauthorizedException();
    return { ...tokens, user: safeUser(session.user), session: { id: session.id, activeOrganizationId: session.activeOrganizationId } };
  }
  async logout(user: Principal) { await this.db.session.updateMany({ where: { id: user.sessionId, userId: user.id }, data: { revokedAt: new Date() } }); return { ok: true }; }
  sessions(user: Principal) { return this.db.session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, createdAt: true, expiresAt: true, userAgent: true, activeOrganizationId: true, activeOrganization: { select: { id: true, name: true } } } }); }
  async current(user: Principal) {
    const session = await this.db.session.findUniqueOrThrow({ where: { id: user.sessionId }, select: { id: true, activeOrganizationId: true, createdAt: true, expiresAt: true } });
    if (session.activeOrganizationId && !await this.db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: session.activeOrganizationId, userId: user.id } } })) {
      await this.db.session.updateMany({ where: { id: user.sessionId, activeOrganizationId: session.activeOrganizationId }, data: { activeOrganizationId: null } });
      session.activeOrganizationId = null;
    }
    return session;
  }
  async workspace(user: Principal, organizationId: string) {
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId}::uuid FOR UPDATE`;
      const member = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } } });
      if (!member) throw new NotFoundException('Equipo no disponible');
      const changed = await tx.session.updateMany({ where: { id: user.sessionId, userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, data: { activeOrganizationId: organizationId } });
      if (!changed.count) throw new UnauthorizedException();
      return { id: user.sessionId, activeOrganizationId: organizationId };
    });
  }
  async revokeOthers(user: Principal) { const changed = await this.db.session.updateMany({ where: { userId: user.id, id: { not: user.sessionId }, revokedAt: null }, data: { revokedAt: new Date() } }); return { revoked: changed.count }; }
  async revoke(user: Principal, sessionId: string) { await this.db.session.updateMany({ where: { id: sessionId, userId: user.id }, data: { revokedAt: new Date() } }); return { ok: true }; }
  async forgot(email: string) {
    if (!process.env.SMTP_HOST) throw new ServiceUnavailableException('Recuperación no configurada: falta SMTP');
    const user = await this.db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      const record = await this.db.passwordReset.create({ data: { userId: user.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + 30 * 60000) } });
      const link = new URL(process.env.RESET_URL ?? 'http://localhost:5173/auth/reset'); link.searchParams.set('token', token);
      try {
        await nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 587), secure: process.env.SMTP_SECURE === 'true', ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}), connectionTimeout: 10000 }).sendMail({ from: process.env.SMTP_FROM ?? 'no-reply@footlab.local', to: user.email, subject: 'Restablece tu contraseña FOOTLAB', text: `Este enlace caduca en 30 minutos: ${link.toString()}` });
      } catch { await this.db.passwordReset.delete({ where: { id: record.id } }); /* Same response prevents account enumeration. */ }
    }
    return { message: 'Si existe la cuenta, recibirás instrucciones de recuperación.' };
  }
  async reset(token: string, password: string) {
    const reset = await this.db.passwordReset.findUnique({ where: { tokenHash: digest(token) } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) throw new BadRequestException('Enlace inválido o caducado');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.db.$transaction(async tx => {
      const claimed = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (!claimed.count) throw new BadRequestException('Enlace usado');
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } });
      await tx.session.updateMany({ where: { userId: reset.userId }, data: { revokedAt: new Date() } });
    }); return { ok: true };
  }
}
