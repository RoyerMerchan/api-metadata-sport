import { z } from 'zod';
import { id } from '@footlab/shared';
export const filterSchema = z.object({ organizationId: id.optional(), seasonId: id.optional(), teamId: id.optional(), competitionId: id.optional(), matchId: id.optional(), position: z.enum(['GK', 'DF', 'MF', 'FW']).optional(), q: z.string().trim().max(100).default(''), limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).default(0) }).strict();
export type SportFilter = z.infer<typeof filterSchema>;
