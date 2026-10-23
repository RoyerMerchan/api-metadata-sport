import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { AccessService } from '../organizations/access.service';
import { Principal } from '../../common/auth';
import { footballCompetition, footballMatches, footballRequest, footballTeams, position, positionMinutes, sbPosition, statsBombRequest } from './adapters';
@Injectable()
export class IntegrationsService {
  constructor(@Inject(PrismaService) private db: PrismaService, @Inject(AccessService) private access: AccessService) {}
  async status() { return { footballData: { configured: Boolean(process.env.FOOTBALL_DATA_TOKEN), attribution: 'football-data.org', url: 'https://www.football-data.org/' }, statsBomb: { importSupported: true, attribution: 'StatsBomb Open Data', url: 'https://github.com/statsbomb/open-data', note: 'Importar un partido, sus lineups y eventos originales. Respetar la licencia del proveedor.' }, sources: await this.db.dataSource.findMany() }; }
  private async fetch(path: string) {
    if (!process.env.FOOTBALL_DATA_TOKEN) throw new ServiceUnavailableException('Configura FOOTBALL_DATA_TOKEN en el backend');
    let response: globalThis.Response;
    try { response = await fetch(`https://api.football-data.org/v4/${path}`, { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_TOKEN }, signal: AbortSignal.timeout(15000) }); } catch { throw new ServiceUnavailableException('Proveedor no disponible'); }
    if (!response.ok) throw new ServiceUnavailableException(`football-data.org respondió ${response.status}; revisa el plan y sus límites`);
    return response.json();
  }
  private async upsert(tx: any, sourceId: string, type: string, externalId: number | string, data: any) {
    const key = { dataSourceId: sourceId, entityType: type, externalId: String(externalId) };
    const existing = await tx.externalIdentifier.findUnique({ where: { dataSourceId_entityType_externalId: key } });
    const entityId = existing?.internalId ?? randomUUID();
    await tx[type].upsert({ where: { id: entityId }, update: data, create: { id: entityId, ...data } });
    await tx.externalIdentifier.upsert({ where: { dataSourceId_entityType_externalId: key }, create: { ...key, internalId: entityId }, update: { internalId: entityId } });
    return entityId as string;
  }
  async football(user: Principal, b: z.infer<typeof footballRequest>) {
    this.access.admin(user);
    const comp = footballCompetition.parse(await this.fetch(`competitions/${b.competition}`));
    const teams = footballTeams.parse(await this.fetch(`competitions/${b.competition}/teams?season=${b.season}`));
    const matches = footballMatches.parse(await this.fetch(`competitions/${b.competition}/matches?season=${b.season}`));
    if (!matches.matches.length) throw new BadRequestException('El proveedor no devolvió partidos para esta temporada');
    return this.db.$transaction(async tx => {
      const source = await tx.dataSource.upsert({ where: { key: 'FOOTBALL_DATA' }, create: { key: 'FOOTBALL_DATA', name: 'football-data.org', attribution: 'Datos proporcionados por football-data.org' }, update: {} });
      const competitionId = await this.upsert(tx, source.id, 'competition', comp.id, { name: comp.name, country: comp.area?.name, source: source.key, organizationId: null });
      const dates = matches.matches[0]!.season;
      const seasonId = await this.upsert(tx, source.id, 'season', `${comp.id}-${b.season}`, { competitionId, name: String(b.season), startDate: new Date(dates.startDate), endDate: new Date(dates.endDate) });
      const teamIds = new Map<number, string>();
      for (const team of teams.teams) {
        const teamId = await this.upsert(tx, source.id, 'team', team.id, { name: team.name, organizationId: null, source: source.key }); teamIds.set(team.id, teamId);
        for (const p of team.squad ?? []) {
          const playerId = await this.upsert(tx, source.id, 'player', p.id, { name: p.name, position: position(p.position), birthDate: p.dateOfBirth ? new Date(p.dateOfBirth.slice(0, 10)) : null, nationality: p.nationality, organizationId: null, source: source.key });
          await tx.squadMembership.upsert({ where: { playerId_teamId_seasonId: { playerId, teamId, seasonId } }, create: { playerId, teamId, seasonId, joinedAt: new Date(dates.startDate) }, update: {} });
        }
      }
      let imported = 0;
      for (const m of matches.matches) {
        const homeTeamId = teamIds.get(m.homeTeam.id), awayTeamId = teamIds.get(m.awayTeam.id);
        if (!homeTeamId || !awayTeamId) continue;
        await this.upsert(tx, source.id, 'match', m.id, { organizationId: null, seasonId, homeTeamId, awayTeamId, kickoff: new Date(m.utcDate), status: m.status === 'FINISHED' ? 'FINISHED' : ['IN_PLAY', 'PAUSED'].includes(m.status) ? 'LIVE' : 'SCHEDULED', homeScore: m.score.fullTime.home, awayScore: m.score.fullTime.away, source: source.key }); imported++;
      }
      await tx.auditLog.create({ data: { actorId: user.id, action: 'integration.football-data', entityId: competitionId } });
      return { competitionId, seasonId, teams: teamIds.size, matches: imported, attribution: source.attribution, statistics: 'Esta importación no incluye minutos, eventos ni estadísticas individuales.' };
    }, { timeout: 120000 });
  }
  async statsBomb(user: Principal, b: z.infer<typeof statsBombRequest>) {
    this.access.admin(user); const m = b.match;
    const expectedTeams = new Set([m.home_team.home_team_id, m.away_team.away_team_id]);
    if (expectedTeams.size !== 2 || b.lineups.some(t => !expectedTeams.has(t.team_id)) || new Set(b.lineups.map(t => t.team_id)).size !== b.lineups.length) throw new BadRequestException('Lineups incompatibles con el partido');
    return this.db.$transaction(async tx => {
      const source = await tx.dataSource.upsert({ where: { key: 'STATSBOMB' }, create: { key: 'STATSBOMB', name: 'StatsBomb Open Data', attribution: 'Datos: StatsBomb Open Data — https://github.com/statsbomb/open-data' }, update: {} });
      const competitionId = await this.upsert(tx, source.id, 'competition', m.competition.competition_id, { name: m.competition.competition_name, country: m.competition.country_name, organizationId: null, source: source.key });
      const seasonExternalId = `${m.competition.competition_id}-${m.season.season_id}`;
      const previousId = await tx.externalIdentifier.findUnique({ where: { dataSourceId_entityType_externalId: { dataSourceId: source.id, entityType: 'season', externalId: seasonExternalId } } });
      const previous = previousId ? await tx.season.findUnique({ where: { id: previousId.internalId } }) : null;
      const observedDate = new Date(m.match_date);
      const seasonId = await this.upsert(tx, source.id, 'season', seasonExternalId, { competitionId, name: m.season.season_name, startDate: previous && previous.startDate < observedDate ? previous.startDate : observedDate, endDate: previous && previous.endDate > observedDate ? previous.endDate : observedDate, datesAreCoverage: true });
      const homeTeamId = await this.upsert(tx, source.id, 'team', m.home_team.home_team_id, { name: m.home_team.home_team_name, organizationId: null, source: source.key });
      const awayTeamId = await this.upsert(tx, source.id, 'team', m.away_team.away_team_id, { name: m.away_team.away_team_name, organizationId: null, source: source.key });
      const matchId = await this.upsert(tx, source.id, 'match', m.match_id, { seasonId, homeTeamId, awayTeamId, organizationId: null, kickoff: new Date(`${m.match_date}T${m.kick_off ?? '00:00:00'}Z`), kickoffTimezoneKnown: false, status: 'FINISHED', homeScore: m.home_score, awayScore: m.away_score, source: source.key });
      await tx.matchEvent.deleteMany({ where: { matchId } }); await tx.matchAppearance.deleteMany({ where: { matchId } });
      const players = new Map<number, { id: string; teamId: string }>();
      for (const team of b.lineups) {
        const teamId = team.team_id === m.home_team.home_team_id ? homeTeamId : awayTeamId;
        for (const p of team.lineup) {
          const playerId = await this.upsert(tx, source.id, 'player', p.player_id, { name: p.player_name, position: sbPosition(p.positions?.[0]?.position_id), nationality: p.country?.name, organizationId: null, source: source.key });
          await tx.squadMembership.upsert({ where: { playerId_teamId_seasonId: { playerId, teamId, seasonId } }, create: { playerId, teamId, seasonId, joinedAt: new Date(m.match_date) }, update: {} });
          const minutes = positionMinutes(p.positions ?? []);
          if (minutes !== null) { await tx.matchAppearance.create({ data: { playerId, teamId, matchId, minutes, starter: p.positions?.[0]?.from === '00:00' } }); players.set(p.player_id, { id: playerId, teamId }); }
        }
      }
      let importedEvents = 0;
      for (const e of b.events) {
        const p = e.player ? players.get(e.player.id) : undefined;
        if (!p || e.minute > 130) continue;
        const eventTeamId = e.team?.id === m.home_team.home_team_id ? homeTeamId : e.team?.id === m.away_team.away_team_id ? awayTeamId : null;
        if (eventTeamId !== p.teamId) continue;
        const card = e.bad_behaviour?.card.name ?? e.foul_committed?.card?.name;
        const type = e.type.name === 'Shot' && e.shot?.outcome.name === 'Goal' ? 'GOAL' : e.type.name === 'Own Goal Against' ? 'OWN_GOAL' : card === 'Yellow Card' ? 'YELLOW_CARD' : card === 'Red Card' || card === 'Second Yellow' ? 'RED_CARD' : e.type.name === 'Substitution' ? 'SUBSTITUTION' : null;
        const related = e.substitution ? players.get(e.substitution.replacement.id) : undefined;
        if (!type || (type === 'SUBSTITUTION' && (!related || related.teamId !== p.teamId))) continue;
        await tx.matchEvent.create({ data: { matchId, teamId: p.teamId, playerId: p.id, relatedPlayerId: related?.id, type, minute: e.minute } }); importedEvents++;
      }
      await tx.auditLog.create({ data: { actorId: user.id, action: 'integration.statsbomb', entityId: matchId } });
      return { matchId, playersWithMinutes: players.size, events: importedEvents, attribution: source.attribution, dateCoverage: 'Fechas de temporada: cobertura de partidos importados. La hora del dataset no incluye zona horaria; se conserva sin convertir.' };
    }, { timeout: 120000 });
  }
}
