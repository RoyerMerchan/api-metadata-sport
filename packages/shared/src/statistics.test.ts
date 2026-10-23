import { expect, it } from 'vitest';
import { per90, eventSchema, matchSchema } from './index';
it('normaliza por 90 sin inventar datos con cero minutos', () => { expect(per90(3, 180)).toBe(1.5); expect(per90(0, 0)).toBeNull(); });
it('rechaza sustituciones incompletas y partidos contra uno mismo', () => {
  const uuid = '11111111-1111-4111-8111-111111111111';
  expect(eventSchema.safeParse({ matchId: uuid, teamId: uuid, playerId: uuid, type: 'SUBSTITUTION', minute: 50 }).success).toBe(false);
  expect(matchSchema.safeParse({ homeTeamId: uuid, awayTeamId: uuid, seasonId: uuid, kickoff: new Date().toISOString() }).success).toBe(false);
});
