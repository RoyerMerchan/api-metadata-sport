import { Inject, Injectable } from '@nestjs/common';
import { per90 } from '@footlab/shared';
import { PrismaService } from '../../database/prisma.service';
import { Principal } from '../../common/auth';
import { AccessService } from '../organizations/access.service';
import { SportsService } from '../sports/sports.service';
import { SportFilter } from '../sports/sports.dto';
@Injectable()
export class StatisticsService {
  constructor(@Inject(PrismaService) private db: PrismaService, @Inject(AccessService) private access: AccessService, @Inject(SportsService) private sports: SportsService) {}
  async player(user: Principal, playerId: string, f: Pick<SportFilter, 'organizationId' | 'seasonId'>) {
    const organizationId = await this.access.scope(user, f.organizationId);
    const player = await this.sports.entity('player', playerId, organizationId);
    if (f.seasonId) await this.sports.season(f.seasonId, organizationId);
    const appearances = await this.db.matchAppearance.findMany({ where: { playerId, match: { organizationId, status: 'FINISHED', ...(f.seasonId ? { seasonId: f.seasonId } : {}) } }, include: { match: { include: { events: { where: { playerId } } } } }, orderBy: { match: { kickoff: 'asc' } } });
    const events = appearances.flatMap(a => a.match.events); const minutes = appearances.reduce((s, a) => s + a.minutes, 0);
    const goals = events.filter(e => e.type === 'GOAL').length; const available = appearances.length > 0;
    return { player, available, appearances: appearances.length, minutes, goals: available ? goals : null, assists: null, yellowCards: available ? events.filter(e => e.type === 'YELLOW_CARD').length : null, redCards: available ? events.filter(e => e.type === 'RED_CARD').length : null, goalsPer90: per90(goals, minutes), evolution: appearances.map(a => ({ date: a.match.kickoff.toISOString(), minutes: a.minutes, goals: a.match.events.filter(e => e.type === 'GOAL').length })), coverage: 'Solo participaciones y eventos registrados. Las asistencias no están disponibles.' };
  }
  async standings(user: Principal, f: SportFilter) {
    const organizationId = await this.access.scope(user, f.organizationId);
    if (f.seasonId) await this.sports.season(f.seasonId, organizationId);
    const matches = await this.db.match.findMany({ where: { organizationId, status: 'FINISHED', ...(f.seasonId ? { seasonId: f.seasonId } : {}) }, include: { homeTeam: true, awayTeam: true } });
    const rows = new Map<string, { id: string; name: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number }>();
    for (const m of matches) {
      if (m.homeScore === null || m.awayScore === null) continue;
      for (const [team, gf, ga] of [[m.homeTeam, m.homeScore, m.awayScore], [m.awayTeam, m.awayScore, m.homeScore]] as const) {
        const r = rows.get(team.id) ?? { id: team.id, name: team.name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
        r.played++; r.gf += gf; r.ga += ga; r.gd = r.gf - r.ga;
        if (gf > ga) { r.won++; r.points += 3; } else if (gf === ga) { r.drawn++; r.points++; } else r.lost++;
        rows.set(team.id, r);
      }
    }
    return { items: [...rows.values()].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)), coverage: 'Calculada con resultados importados o registrados; sin deducciones disciplinarias.', seasonId: f.seasonId ?? null };
  }
  async dashboard(user: Principal, f: SportFilter) {
    const organizationId = await this.access.scope(user, f.organizationId);
    const where = { organizationId };
    const matchWhere = { organizationId, ...(f.seasonId ? { seasonId: f.seasonId } : {}), ...(f.teamId ? { OR: [{ homeTeamId: f.teamId }, { awayTeamId: f.teamId }] } : {}) };
    const [players, teams, matches, recent, goals, demo] = await Promise.all([
      this.db.player.count({ where: { ...where, archivedAt: null } }), this.db.team.count({ where: { ...where, archivedAt: null } }),
      this.db.match.count({ where: matchWhere }), this.db.match.findMany({ where: matchWhere, include: { homeTeam: true, awayTeam: true }, orderBy: { kickoff: 'desc' }, take: 5 }),
      this.db.match.aggregate({ where: { ...matchWhere, status: 'FINISHED' }, _sum: { homeScore: true, awayScore: true } }),
      organizationId ? this.db.organization.findUnique({ where: { id: organizationId }, select: { isDemo: true } }) : Promise.resolve(null),
    ]);
    return { players, teams, matches, goals: goals._sum.homeScore === null ? null : goals._sum.homeScore + (goals._sum.awayScore ?? 0), recent, isDemo: demo?.isDemo ?? false };
  }
}
