import { z } from 'zod';
export const footballRequest = z.object({ competition: z.string().regex(/^[A-Z0-9]{2,8}$/), season: z.number().int().min(2000).max(2100) }).strict();
export const footballCompetition = z.object({ id: z.number(), name: z.string(), area: z.object({ name: z.string() }).optional() }).passthrough();
export const footballTeams = z.object({ teams: z.array(z.object({ id: z.number(), name: z.string(), squad: z.array(z.object({ id: z.number(), name: z.string(), position: z.string().nullable().optional(), dateOfBirth: z.string().nullable().optional(), nationality: z.string().nullable().optional() }).passthrough()).optional() }).passthrough()) }).passthrough();
export const footballMatches = z.object({ matches: z.array(z.object({ id: z.number(), utcDate: z.string(), status: z.string(), homeTeam: z.object({ id: z.number() }), awayTeam: z.object({ id: z.number() }), season: z.object({ startDate: z.string(), endDate: z.string() }).passthrough(), score: z.object({ fullTime: z.object({ home: z.number().nullable(), away: z.number().nullable() }) }).passthrough() }).passthrough()) }).passthrough();
const sbPlayer = z.object({ player_id: z.number(), player_name: z.string(), country: z.object({ name: z.string() }).nullable().optional(), positions: z.array(z.object({ position_id: z.number(), from: z.string(), to: z.string().nullable() }).passthrough()).optional() }).passthrough();
export const statsBombRequest = z.object({
  match: z.object({ match_id: z.number(), match_date: z.string().date(), kick_off: z.string().optional(), home_score: z.number().int().nonnegative(), away_score: z.number().int().nonnegative(), competition: z.object({ competition_id: z.number(), competition_name: z.string(), country_name: z.string().optional() }), season: z.object({ season_id: z.number(), season_name: z.string() }), home_team: z.object({ home_team_id: z.number(), home_team_name: z.string() }).passthrough(), away_team: z.object({ away_team_id: z.number(), away_team_name: z.string() }).passthrough() }).passthrough(),
  lineups: z.array(z.object({ team_id: z.number(), team_name: z.string(), lineup: z.array(sbPlayer).max(40) }).passthrough()).max(2),
  events: z.array(z.object({ id: z.string(), type: z.object({ name: z.string() }), minute: z.number().int().min(0).max(200), team: z.object({ id: z.number() }).optional(), player: z.object({ id: z.number() }).optional(), shot: z.object({ outcome: z.object({ name: z.string() }) }).passthrough().optional(), bad_behaviour: z.object({ card: z.object({ name: z.string() }) }).optional(), foul_committed: z.object({ card: z.object({ name: z.string() }).optional() }).passthrough().optional(), substitution: z.object({ replacement: z.object({ id: z.number() }) }).passthrough().optional() }).passthrough()).max(15000),
}).strict();
export const position = (v?: string | null) => { const s = v?.toLowerCase() ?? ''; return s.includes('keeper') ? 'GK' : /back|defen/.test(s) ? 'DF' : /midfield/.test(s) ? 'MF' : /forward|wing|attack|striker|offen/.test(s) ? 'FW' : 'UNKNOWN'; };
export const sbPosition = (v?: number) => !v ? 'UNKNOWN' : v === 1 ? 'GK' : v <= 8 ? 'DF' : v <= 18 ? 'MF' : 'FW';
export function positionMinutes(positions: { from: string; to: string | null }[]): number | null {
  if (!positions.length || positions.some(p => !p.to)) return null;
  const seconds = (v: string) => { const [min, sec] = v.split(':').map(Number); return (min ?? 0) * 60 + (sec ?? 0); };
  const total = positions.reduce((sum, p) => sum + Math.max(0, seconds(p.to!) - seconds(p.from)), 0);
  return Number.isFinite(total) ? Math.min(120, Math.round(total / 60)) : null;
}
