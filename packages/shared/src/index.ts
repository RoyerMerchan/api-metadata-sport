import { z } from 'zod';
export const roles = ['OWNER', 'DIRECTOR', 'COACH', 'ANALYST', 'SCOUT', 'PLAYER', 'VIEWER'] as const;
export type ClubRole = typeof roles[number];
export const grants: Record<ClubRole, readonly string[]> = {
  OWNER: ['club:read', 'club:write', 'members:write', 'sport:write', 'analysis:write'],
  DIRECTOR: ['club:read', 'club:write', 'members:write', 'sport:write', 'analysis:write'],
  COACH: ['club:read', 'sport:write', 'analysis:write'], ANALYST: ['club:read', 'analysis:write'],
  SCOUT: ['club:read', 'analysis:write'], PLAYER: ['club:read'], VIEWER: ['club:read'],
};
export const id = z.string().uuid();
export const name = z.string().trim().min(2).max(120);
export const password = z.string().min(12).max(128);
export const loginSchema = z.object({ email: z.string().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(1).max(128) }).strict();
export const registerSchema = loginSchema.extend({ name, password, organizationName: name.optional() });
export const inviteRoles = ['DIRECTOR', 'COACH', 'ANALYST', 'SCOUT', 'PLAYER', 'VIEWER'] as const;
export const invitationSchema = z.object({ email: z.string().email().max(254).transform(v => v.toLowerCase()), role: z.enum(inviteRoles) }).strict();
export const acceptInvitationSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const organizationSchema = z.object({ name }).strict();
export const teamSchema = z.object({ name, category: z.string().max(60).default('Absoluta') }).strict();
export const playerSchema = z.object({ name, position: z.enum(['GK', 'DF', 'MF', 'FW']), birthDate: z.string().date().optional(), nationality: z.string().max(80).optional() }).strict();
export const competitionSchema = z.object({ name, country: z.string().max(80).optional() }).strict();
export const seasonSchema = z.object({ competitionId: id, name, startDate: z.string().date(), endDate: z.string().date() }).strict().refine(v => v.endDate >= v.startDate, 'La temporada debe terminar después de empezar');
export const matchSchema = z.object({ homeTeamId: id, awayTeamId: id, seasonId: id, kickoff: z.string().datetime({ offset: true }) }).strict().refine(v => v.homeTeamId !== v.awayTeamId, 'Los equipos deben ser diferentes');
export const resultSchema = z.object({ status: z.enum(['SCHEDULED', 'LIVE', 'FINISHED']), homeScore: z.number().int().min(0).max(99).nullable(), awayScore: z.number().int().min(0).max(99).nullable() }).strict().refine(v => v.status !== 'FINISHED' || (v.homeScore !== null && v.awayScore !== null), 'Un partido finalizado necesita resultado');
export const eventSchema = z.object({ matchId: id, teamId: id, playerId: id, relatedPlayerId: id.optional(), minute: z.number().int().min(0).max(130), type: z.enum(['GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION']) }).strict().refine(v => v.type !== 'SUBSTITUTION' || (!!v.relatedPlayerId && v.relatedPlayerId !== v.playerId), 'La sustitución necesita un jugador entrante distinto');
export const appearanceSchema = z.object({ playerId: id, teamId: id, minutes: z.number().int().min(0).max(120), starter: z.boolean(), shirtNumber: z.number().int().min(1).max(99).optional() }).strict();
export const lineupSchema = z.object({ teamId: id, formation: z.string().regex(/^\d(-\d){1,4}$/), appearances: z.array(appearanceSchema).max(30) }).strict();
export const squadSchema = z.object({ playerId: id, teamId: id, seasonId: id, shirtNumber: z.number().int().min(1).max(99).optional(), joinedAt: z.string().date(), leftAt: z.string().date().optional() }).strict().refine(v => !v.leftAt || v.leftAt >= v.joinedAt, 'Fechas de plantilla inválidas');
export const staffSchema = z.object({ teamId: id, name, job: z.string().min(2).max(80) }).strict();
export const evaluationSchema = z.object({ playerId: id, seasonId: id, rating: z.number().min(0).max(10), notes: z.string().max(4000) }).strict();
export interface PlayerSummary { id: string; name: string; position: string; organizationId: string | null; isDemo: boolean; nationality?: string | null }
export interface PlayerStats { player: PlayerSummary; available: boolean; appearances: number; minutes: number; goals: number | null; assists: number | null; yellowCards: number | null; redCards: number | null; goalsPer90: number | null; evolution: { date: string; minutes: number; goals: number }[] }
export function per90(total: number, minutes: number): number | null { return minutes > 0 ? Math.round(total * 90 / minutes * 100) / 100 : null; }
export const futureCapabilities = ['Scouting avanzado', 'Mapas de calor', 'Mapas de disparos', 'Redes de pases', 'xG / xA', 'Informes PDF', 'Análisis de video', 'Asistente IA', 'Pizarra táctica'] as const;
