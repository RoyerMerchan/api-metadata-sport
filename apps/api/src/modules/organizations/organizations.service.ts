import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ClubRole, grants, roles } from '@footlab/shared';
import { PrismaService } from '../../database/prisma.service';
import { Principal } from '../../common/auth';
import { AccessService } from './access.service';
export async function ensureRoles(db: any) {
  for (const key of roles) {
    const permissions = [];
    for (const permission of grants[key]) permissions.push(await db.permission.upsert({ where: { key: permission }, update: {}, create: { key: permission } }));
    await db.role.upsert({ where: { key }, create: { key, permissions: { connect: permissions.map(p => ({ id: p.id })) } }, update: { permissions: { set: permissions.map(p => ({ id: p.id })) } } });
  }
}
@Injectable()
export class OrganizationsService {
  constructor(@Inject(PrismaService) private db: PrismaService, @Inject(AccessService) private access: AccessService) {}
  list(user: Principal) { return this.db.organizationMember.findMany({ where: { userId: user.id }, include: { organization: true, role: { select: { key: true, permissions: { select: { key: true } } } } } }); }
  async create(user: Principal, name: string) {
    await ensureRoles(this.db);
    const role = await this.db.role.findUniqueOrThrow({ where: { key: 'OWNER' } });
    return this.db.$transaction(async tx => {
      const org = await tx.organization.create({ data: { name, members: { create: { userId: user.id, roleId: role.id } }, teams: { create: { name } }, audits: { create: { actorId: user.id, action: 'organization.create', entityId: 'self' } } } });
      const changed = await tx.session.updateMany({ where: { id: user.sessionId, userId: user.id, revokedAt: null }, data: { activeOrganizationId: org.id } });
      if (!changed.count) throw new UnauthorizedException();
      return org;
    });
  }
  async members(user: Principal, org: string) { await this.access.scope(user, org); return this.db.organizationMember.findMany({ where: { organizationId: org }, include: { user: { select: { id: true, name: true, email: true } }, role: { select: { key: true } } } }); }
  async update(user: Principal, org: string, name: string) { await this.access.scope(user, org, 'club:write'); return this.db.organization.update({ where: { id: org }, data: { name } }); }
  async member(user: Principal, org: string, email: string, roleKey: ClubRole) {
    await this.access.scope(user, org, 'members:write');
    const target = await this.db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!target) throw new NotFoundException('El usuario debe registrarse primero');
    const role = await this.db.role.findUniqueOrThrow({ where: { key: roleKey } });
    return this.db.$transaction(async tx => {
      // Serialize role edits per organization; preserve at least one owner.
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${org}::uuid FOR UPDATE`;
      const caller = await tx.organizationMember.findUniqueOrThrow({ where: { organizationId_userId: { organizationId: org, userId: user.id } }, include: { role: true } });
      const existing = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: org, userId: target.id } }, include: { role: true } });
      if ((roleKey === 'OWNER' || existing?.role.key === 'OWNER') && caller.role.key !== 'OWNER') throw new ConflictException('Solo OWNER administra propietarios');
      if (existing?.role.key === 'OWNER' && roleKey !== 'OWNER' && await tx.organizationMember.count({ where: { organizationId: org, role: { key: 'OWNER' } } }) <= 1) throw new ConflictException('El club necesita un propietario');
      const result = await tx.organizationMember.upsert({ where: { organizationId_userId: { organizationId: org, userId: target.id } }, update: { roleId: role.id }, create: { organizationId: org, userId: target.id, roleId: role.id } });
      await tx.auditLog.create({ data: { organizationId: org, actorId: user.id, action: 'member.role', entityId: target.id } }); return result;
    });
  }
  async invite(user: Principal, org: string, email: string, role: Exclude<ClubRole, 'OWNER'>) {
    await this.access.scope(user, org, 'members:write');
    const token = randomBytes(32).toString('hex');
    const invitation = await this.db.organizationInvitation.create({ data: { organizationId: org, issuerId: user.id, email, role, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 7 * 86400000) }, select: { id: true, email: true, role: true, expiresAt: true } });
    return { ...invitation, token };
  }
  async invitations(user: Principal, org: string) {
    await this.access.scope(user, org, 'members:write');
    return this.db.organizationInvitation.findMany({ where: { organizationId: org, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, email: true, role: true, expiresAt: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  }
  async revokeInvitation(user: Principal, org: string, invitationId: string) {
    await this.access.scope(user, org, 'members:write');
    await this.db.organizationInvitation.updateMany({ where: { id: invitationId, organizationId: org, acceptedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  }
  async accept(user: Principal, token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const account = await this.db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } });
    return this.db.$transaction(async tx => {
      const invitation = await tx.organizationInvitation.findUnique({ where: { tokenHash } });
      if (!invitation || invitation.email !== account.email || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date() || invitation.role === 'OWNER') throw new BadRequestException('Invitación inválida, caducada o dirigida a otro correo');
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${invitation.organizationId}::uuid FOR UPDATE`;
      const issuer = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: invitation.organizationId, userId: invitation.issuerId } }, include: { role: { include: { permissions: true } } } });
      if (!issuer?.role.permissions.some(p => p.key === 'members:write')) throw new BadRequestException('La invitación ya no está vigente');
      const claimed = await tx.organizationInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
      if (!claimed.count) throw new BadRequestException('La invitación ya se utilizó');
      const role = await tx.role.findUniqueOrThrow({ where: { key: invitation.role } });
      // Existing members retain their role; an invitation never elevates or demotes them.
      await tx.organizationMember.upsert({ where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } }, update: {}, create: { organizationId: invitation.organizationId, userId: user.id, roleId: role.id } });
      const changed = await tx.session.updateMany({ where: { id: user.sessionId, userId: user.id, revokedAt: null }, data: { activeOrganizationId: invitation.organizationId } });
      if (!changed.count) throw new UnauthorizedException();
      await tx.auditLog.create({ data: { organizationId: invitation.organizationId, actorId: user.id, action: 'invitation.accept', entityId: invitation.id } });
      return { organizationId: invitation.organizationId };
    });
  }
  async removeMember(user: Principal, org: string, targetId: string) {
    await this.access.scope(user, org, 'members:write');
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${org}::uuid FOR UPDATE`;
      const caller = await tx.organizationMember.findUniqueOrThrow({ where: { organizationId_userId: { organizationId: org, userId: user.id } }, include: { role: { include: { permissions: true } } } });
      if (!caller.role.permissions.some(p => p.key === 'members:write')) throw new UnauthorizedException();
      const member = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: org, userId: targetId } }, include: { role: true } });
      if (!member) throw new NotFoundException();
      if (member.role.key === 'OWNER' && (caller.role.key !== 'OWNER' || await tx.organizationMember.count({ where: { organizationId: org, role: { key: 'OWNER' } } }) <= 1)) throw new ConflictException('El club necesita conservar un propietario');
      await tx.organizationMember.delete({ where: { id: member.id } });
      await tx.session.updateMany({ where: { userId: targetId, activeOrganizationId: org }, data: { activeOrganizationId: null } });
      await tx.auditLog.create({ data: { organizationId: org, actorId: user.id, action: 'member.remove', entityId: targetId } });
      return { ok: true };
    });
  }
}
