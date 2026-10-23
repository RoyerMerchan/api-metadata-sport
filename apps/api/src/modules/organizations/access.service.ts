import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { id } from '@footlab/shared';
import { PrismaService } from '../../database/prisma.service';
import type { Principal } from '../../common/auth';
@Injectable()
export class AccessService {
  constructor(@Inject(PrismaService) private db: PrismaService) {}
  async scope(user: Principal, organizationId?: string, permission = 'club:read'): Promise<string | null> {
    if (!organizationId) { if (permission !== 'club:read') throw new BadRequestException('Selecciona una organización'); return null; }
    if (!id.safeParse(organizationId).success) throw new BadRequestException('Organización inválida');
    const member = await this.db.organizationMember.findUnique({ where: { organizationId_userId: { organizationId, userId: user.id } }, include: { role: { include: { permissions: true } } } });
    if (!member) throw new NotFoundException('Organización no encontrada');
    if (!member.role.permissions.some(p => p.key === permission)) throw new ForbiddenException('No tienes permiso para esta acción');
    return organizationId;
  }
  admin(user: Principal) { if (user.globalRole !== 'ADMIN') throw new ForbiddenException('Requiere permiso global de administrador'); }
}
