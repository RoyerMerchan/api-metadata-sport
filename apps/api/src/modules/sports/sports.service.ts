import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { appearanceSchema, eventSchema, lineupSchema, matchSchema, playerSchema, resultSchema, seasonSchema, squadSchema, staffSchema, evaluationSchema, teamSchema, competitionSchema } from '@footlab/shared';
import { PrismaService } from '../../database/prisma.service';
import { Principal } from '../../common/auth';
import { AccessService } from '../organizations/access.service';
import { SportFilter } from './sports.dto';
type Entity = 'player' | 'team' | 'competition' | 'match';
@Injectable()
export class SportsService {
  constructor(@Inject(PrismaService) private db: PrismaService, @Inject(AccessService) private access: AccessService) {}
  private table(entity: Entity): any { return this.db[entity]; }
  async entity(entity: Entity, entityId: string, org: string | null) {
    const record = await this.table(entity).findFirst({ where: { id: entityId, organizationId: org, ...(['team', 'player'].includes(entity) ? { archivedAt: null } : {}) } });
    if (!record) throw new NotFoundException('Registro no encontrado'); return record;
  }
  async season(seasonId: string, org: string | null) {
    const season = await this.db.season.findFirst({ where: { id: seasonId, competition: { organizationId: org } } });
    if (!season) throw new NotFoundException('Temporada no encontrada'); return season;
  }
  async list(entity: Entity, user: Principal, f: SportFilter) {
    const organizationId = await this.access.scope(user, f.organizationId);
    const where: any = { organizationId };
    if (entity !== 'match') where.name = { contains: f.q, mode: 'insensitive' };
    if (entity === 'player' || entity === 'team') where.archivedAt = null;
    if (entity === 'player') {
      if (f.position) where.position = f.position;
      if (f.teamId || f.seasonId) where.squads = { some: { ...(f.teamId ? { teamId: f.teamId } : {}), ...(f.seasonId ? { seasonId: f.seasonId } : {}) } };
    }
    if (entity === 'match') {
      if (f.seasonId) where.seasonId = f.seasonId;
      if (f.teamId) where.OR = [{ homeTeamId: f.teamId }, { awayTeamId: f.teamId }];
    }
    const [items, total] = await Promise.all([
      this.table(entity).findMany({ where, skip: f.offset, take: f.limit, orderBy: entity === 'match' ? { kickoff: 'desc' } : { name: 'asc' }, ...(entity === 'match' ? { include: { homeTeam: true, awayTeam: true, season: true } } : {}) }),
      this.table(entity).count({ where }),
    ]); return { items, total, offset: f.offset, limit: f.limit };
  }
  async detail(entity: Entity, user: Principal, entityId: string, org?: string) {
    const scope = await this.access.scope(user, org); const record = await this.entity(entity, entityId, scope);
    if (entity === 'player') return { ...record, squads: await this.db.squadMembership.findMany({ where: { playerId: entityId }, include: { team: true, season: true }, orderBy: { joinedAt: 'desc' } }) };
    if (entity === 'team') return { ...record, staff: await this.db.staffMember.findMany({ where: { teamId: entityId } }), squads: await this.db.squadMembership.findMany({ where: { teamId: entityId }, include: { player: true, season: true }, orderBy: { joinedAt: 'desc' } }) };
    if (entity === 'match') return this.db.match.findUniqueOrThrow({ where: { id: entityId }, include: { homeTeam: true, awayTeam: true, season: true, lineups: true, appearances: { include: { player: true } }, events: { include: { player: true, relatedPlayer: true }, orderBy: { minute: 'asc' } } } });
    return { ...record, seasons: await this.db.season.findMany({ where: { competitionId: entityId }, orderBy: { startDate: 'desc' } }) };
  }
  async save(entity: 'player' | 'team' | 'competition', user: Principal, input: z.infer<typeof playerSchema> | z.infer<typeof teamSchema> | z.infer<typeof competitionSchema>, org?: string, entityId?: string) {
    const organizationId = await this.access.scope(user, org, 'sport:write');
    if (entityId) await this.entity(entity, entityId, organizationId);
    const data: any = { ...input }; if (data.birthDate) data.birthDate = new Date(data.birthDate);
    return this.db.$transaction(async tx => {
      const table: any = tx[entity];
      const result = entityId ? await table.update({ where: { id: entityId }, data }) : await table.create({ data: { ...data, organizationId } });
      await tx.auditLog.create({ data: { organizationId, actorId: user.id, action: `${entity}.${entityId ? 'update' : 'create'}`, entityId: result.id } }); return result;
    });
  }
  async archive(entity: 'player' | 'team', user: Principal, entityId: string, org?: string) {
    const organizationId = await this.access.scope(user, org, 'sport:write'); await this.entity(entity, entityId, organizationId);
    return this.db.$transaction(async tx => {
      const result = await (tx[entity] as any).update({ where: { id: entityId }, data: { archivedAt: new Date() } });
      await tx.auditLog.create({ data: { organizationId, actorId: user.id, action: `${entity}.archive`, entityId } }); return result;
    });
  }
  async seasons(user: Principal, f: SportFilter) {
    const organizationId = await this.access.scope(user, f.organizationId);
    return this.db.season.findMany({ where: { competition: { organizationId }, ...(f.competitionId ? { competitionId: f.competitionId } : {}) }, include: { competition: true }, orderBy: { startDate: 'desc' }, take: 100 });
  }
  async createSeason(user: Principal, b: z.infer<typeof seasonSchema>, org?: string) {
    const scope = await this.access.scope(user, org, 'sport:write'); await this.entity('competition', b.competitionId, scope);
    return this.db.season.create({ data: { ...b, startDate: new Date(b.startDate), endDate: new Date(b.endDate) } });
  }
  async squad(user: Principal, b: z.infer<typeof squadSchema>, org?: string) {
    const scope = await this.access.scope(user, org, 'sport:write');
    await Promise.all([this.entity('player', b.playerId, scope), this.entity('team', b.teamId, scope), this.season(b.seasonId, scope)]);
    const data = { ...b, joinedAt: new Date(b.joinedAt), leftAt: b.leftAt ? new Date(b.leftAt) : null };
    return this.db.squadMembership.upsert({ where: { playerId_teamId_seasonId: { playerId: b.playerId, teamId: b.teamId, seasonId: b.seasonId } }, create: data, update: data });
  }
  async staff(user: Principal, b: z.infer<typeof staffSchema>, org?: string) { const scope = await this.access.scope(user, org, 'sport:write'); await this.entity('team', b.teamId, scope); return this.db.staffMember.create({ data: b }); }
  async removeStaff(user: Principal, staffId: string, org?: string) {
    const scope = await this.access.scope(user, org, 'sport:write'); const staff = await this.db.staffMember.findFirst({ where: { id: staffId, team: { organizationId: scope } } });
    if (!staff) throw new NotFoundException(); return this.db.staffMember.delete({ where: { id: staffId } });
  }
  async createMatch(user: Principal, b: z.infer<typeof matchSchema>, org?: string) {
    const organizationId = await this.access.scope(user, org, 'sport:write');
    await Promise.all([this.entity('team', b.homeTeamId, organizationId), this.entity('team', b.awayTeamId, organizationId), this.season(b.seasonId, organizationId)]);
    return this.db.match.create({ data: { ...b, kickoff: new Date(b.kickoff), organizationId } });
  }
  async result(user: Principal, matchId: string, b: z.infer<typeof resultSchema>, org?: string) { const scope = await this.access.scope(user, org, 'sport:write'); await this.entity('match', matchId, scope); return this.db.match.update({ where: { id: matchId }, data: b }); }
  async lineup(user: Principal, matchId: string, b: z.infer<typeof lineupSchema>, org?: string) {
    const scope = await this.access.scope(user, org, 'sport:write'); const match = await this.entity('match', matchId, scope);
    if (![match.homeTeamId, match.awayTeamId].includes(b.teamId) || b.appearances.some(p => p.teamId !== b.teamId)) throw new BadRequestException('Equipo inválido');
    if (new Set(b.appearances.map(p => p.playerId)).size !== b.appearances.length || b.appearances.filter(p => p.starter).length > 11) throw new BadRequestException('Jugadores repetidos o más de 11 titulares');
    for (const p of b.appearances) await this.validateSquad(p, match, scope);
    return this.db.$transaction(async tx => {
      const existingEvents = await tx.matchEvent.findMany({ where: { matchId, teamId: b.teamId } });
      if (existingEvents.some(e => !b.appearances.some(a => a.playerId === e.playerId) || (e.relatedPlayerId && !b.appearances.some(a => a.playerId === e.relatedPlayerId)))) throw new ConflictException('No se puede quitar un jugador con eventos registrados');
      await tx.matchAppearance.deleteMany({ where: { matchId, teamId: b.teamId } });
      await tx.matchAppearance.createMany({ data: b.appearances.map(p => ({ ...p, matchId })) });
      return tx.matchLineup.upsert({ where: { matchId_teamId: { matchId, teamId: b.teamId } }, create: { matchId, teamId: b.teamId, formation: b.formation }, update: { formation: b.formation } });
    });
  }
  private async validateSquad(p: z.infer<typeof appearanceSchema>, match: any, scope: string | null) {
    await this.entity('player', p.playerId, scope);
    const squad = await this.db.squadMembership.findFirst({ where: { playerId: p.playerId, teamId: p.teamId, seasonId: match.seasonId, joinedAt: { lte: match.kickoff }, OR: [{ leftAt: null }, { leftAt: { gte: match.kickoff } }] } });
    if (!squad) throw new BadRequestException('El jugador no pertenece a la plantilla en la fecha del partido');
  }
  async events(user: Principal, f: SportFilter) { const scope = await this.access.scope(user, f.organizationId); return this.db.matchEvent.findMany({ where: { match: { organizationId: scope }, ...(f.matchId ? { matchId: f.matchId } : {}) }, include: { player: true, relatedPlayer: true }, orderBy: { minute: 'asc' }, take: f.limit, skip: f.offset }); }
  async createEvent(user: Principal, b: z.infer<typeof eventSchema>, org?: string) {
    const scope = await this.access.scope(user, org, 'sport:write'); const match = await this.entity('match', b.matchId, scope);
    if (![match.homeTeamId, match.awayTeamId].includes(b.teamId)) throw new BadRequestException('Equipo ajeno al partido');
    for (const playerId of [b.playerId, b.relatedPlayerId].filter(Boolean) as string[]) {
      const appearance = await this.db.matchAppearance.findFirst({ where: { matchId: b.matchId, playerId, teamId: b.teamId } });
      if (!appearance) throw new BadRequestException('Registra la convocatoria antes del evento');
    }
    return this.db.matchEvent.create({ data: b });
  }
  async removeEvent(user: Principal, eventId: string, org?: string) {
    const scope = await this.access.scope(user, org, 'sport:write'); const event = await this.db.matchEvent.findFirst({ where: { id: eventId, match: { organizationId: scope } } });
    if (!event) throw new NotFoundException(); return this.db.matchEvent.delete({ where: { id: eventId } });
  }
  async evaluate(user: Principal, b: z.infer<typeof evaluationSchema>, org?: string) {
    const organizationId = await this.access.scope(user, org, 'analysis:write');
    await Promise.all([this.entity('player', b.playerId, organizationId), this.season(b.seasonId, organizationId)]);
    return this.db.scoutingReport.create({ data: { ...b, organizationId: organizationId!, authorId: user.id } });
  }
  async evaluations(user: Principal, playerId: string, org?: string) { const organizationId = await this.access.scope(user, org); if (!organizationId) return []; await this.entity('player', playerId, organizationId); return this.db.scoutingReport.findMany({ where: { organizationId, playerId }, orderBy: { createdAt: 'desc' } }); }
}
