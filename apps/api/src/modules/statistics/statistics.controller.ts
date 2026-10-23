import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { id } from '@footlab/shared';
import { CurrentUser, Principal } from '../../common/auth';
import { ZodPipe } from '../../common/http';
import { filterSchema, SportFilter } from '../sports/sports.dto';
import { StatisticsService } from './statistics.service';
const comparisonSchema = z.object({ left: id, right: id, organizationId: id.optional(), seasonId: id.optional() }).strict();
@ApiTags('statistics') @ApiBearerAuth() @Controller()
export class StatisticsController {
  constructor(@Inject(StatisticsService) private s: StatisticsService) {}
  @Get('statistics') dashboard(@CurrentUser() u: Principal, @Query(new ZodPipe(filterSchema)) q: SportFilter) { return this.s.dashboard(u, q); }
  @Get('statistics/standings') standings(@CurrentUser() u: Principal, @Query(new ZodPipe(filterSchema)) q: SportFilter) { return this.s.standings(u, q); }
  @Get('statistics/players/:id') player(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodPipe(filterSchema)) q: SportFilter) { return this.s.player(u, id, q); }
  @Get('comparisons') async compare(@CurrentUser() u: Principal, @Query(new ZodPipe(comparisonSchema)) q: z.infer<typeof comparisonSchema>) { const [left, right] = await Promise.all([this.s.player(u, q.left, q), this.s.player(u, q.right, q)]); return { left, right }; }
}
