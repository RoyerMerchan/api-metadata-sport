import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Principal } from '../../common/auth';
import { PrismaService } from '../../database/prisma.service';
import { AccessService } from '../organizations/access.service';
@Injectable()
export class FavoritesService {
  constructor(@Inject(PrismaService) private db: PrismaService, @Inject(AccessService) private access: AccessService) {}
  list(u: Principal) { const visible = { OR: [{ organizationId: null }, { organization: { members: { some: { userId: u.id } } } }] }; return this.db.favorite.findMany({ where: { userId: u.id, OR: [{ player: visible }, { team: visible }] }, include: { player: true, team: true } }); }
  async add(u: Principal, b: { playerId?: string; teamId?: string }) {
    const target = b.playerId ? await this.db.player.findUnique({ where: { id: b.playerId } }) : await this.db.team.findUnique({ where: { id: b.teamId! } });
    if (!target) throw new NotFoundException(); await this.access.scope(u, target.organizationId ?? undefined);
    return b.playerId ? this.db.favorite.upsert({ where: { userId_playerId: { userId: u.id, playerId: b.playerId } }, update: {}, create: { userId: u.id, playerId: b.playerId } }) : this.db.favorite.upsert({ where: { userId_teamId: { userId: u.id, teamId: b.teamId! } }, update: {}, create: { userId: u.id, teamId: b.teamId! } });
  }
  async remove(u: Principal, id: string) { await this.db.favorite.deleteMany({ where: { id, userId: u.id } }); return { ok: true }; }
}
