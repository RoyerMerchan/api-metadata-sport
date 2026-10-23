import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { competitionSchema, eventSchema, evaluationSchema, lineupSchema, matchSchema, playerSchema, resultSchema, seasonSchema, squadSchema, staffSchema, teamSchema } from '@footlab/shared';
import { CurrentUser, Principal } from '../../common/auth';
import { ZodPipe, ValidatedBody } from '../../common/http';
import { SportsService } from './sports.service';
import { filterSchema, SportFilter } from './sports.dto';
@ApiTags('sports') @ApiBearerAuth() @Controller()
export class SportsController {
  constructor(@Inject(SportsService) private s: SportsService) {}
  @Get('players') players(@CurrentUser() u: Principal, @Query(new ZodPipe(filterSchema)) q: SportFilter) { return this.s.list('player', u, q); }
  @Get('players/:id') player(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) { return this.s.detail('player', u, id, org); }
  @Post('players') createPlayer(@CurrentUser() u: Principal, @ValidatedBody(playerSchema) b: z.infer<typeof playerSchema>, @Query('organizationId') org?: string) { return this.s.save('player', u, b, org); }
  @Patch('players/:id') updatePlayer(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @ValidatedBody(playerSchema.partial()) b: z.infer<ReturnType<typeof playerSchema.partial>>, @Query('organizationId') org?: string) { return this.s.save('player', u, b as any, org, id); }
  @Delete('players/:id') archivePlayer(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) { return this.s.archive('player', u, id, org); }
  @Get('teams') teams(@CurrentUser() u: Principal, @Query(new ZodPipe(filterSchema)) q: SportFilter) { return this.s.list('team', u, q); }
  @Get('teams/:id') team(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) { return this.s.detail('team', u, id, org); }
  @Post('teams') createTeam(@CurrentUser() u: Principal, @ValidatedBody(teamSchema) b: z.infer<typeof teamSchema>, @Query('organizationId') org?: string) { return this.s.save('team', u, b, org); }
  @Patch('teams/:id') updateTeam(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @ValidatedBody(teamSchema.partial()) b: any, @Query('organizationId') org?: string) { return this.s.save('team', u, b, org, id); }
  @Delete('teams/:id') archiveTeam(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) { return this.s.archive('team', u, id, org); }
  @Post('teams/squads') squad(@CurrentUser() u: Principal, @ValidatedBody(squadSchema) b: z.infer<typeof squadSchema>, @Query('organizationId') org?: string) { return this.s.squad(u, b, org); }
  @Post('teams/staff') staff(@CurrentUser() u: Principal, @ValidatedBody(staffSchema) b: z.infer<typeof staffSchema>, @Query('organizationId') org?: string) { return this.s.staff(u, b, org); }
  @Delete('teams/staff/:id') removeStaff(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) { return this.s.removeStaff(u, id, org); }
  @Get('competitions') competitions(@CurrentUser() u: Principal, @Query(new ZodPipe(filterSchema)) q: SportFilter) { return this.s.list('competition', u, q); }
  @Get('competitions/seasons') seasons(@CurrentUser() u: Principal, @Query(new ZodPipe(filterSchema)) q: SportFilter) { return this.s.seasons(u, q); }
  @Post('competitions/seasons') createSeason(@CurrentUser() u: Principal, @ValidatedBody(seasonSchema) b: z.infer<typeof seasonSchema>, @Query('organizationId') org?: string) { return this.s.createSeason(u, b, org); }
  @Get('competitions/:id') competition(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) { return this.s.detail('competition', u, id, org); }
  @Post('competitions') createCompetition(@CurrentUser() u: Principal, @ValidatedBody(competitionSchema) b: z.infer<typeof competitionSchema>, @Query('organizationId') org?: string) { return this.s.save('competition', u, b, org); }
  @Get('matches') matches(@CurrentUser() u: Principal, @Query(new ZodPipe(filterSchema)) q: SportFilter) { return this.s.list('match', u, q); }
  @Get('matches/:id') match(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) { return this.s.detail('match', u, id, org); }
  @Post('matches') createMatch(@CurrentUser() u: Principal, @ValidatedBody(matchSchema) b: z.infer<typeof matchSchema>, @Query('organizationId') org?: string) { return this.s.createMatch(u, b, org); }
  @Patch('matches/:id/result') result(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @ValidatedBody(resultSchema) b: z.infer<typeof resultSchema>, @Query('organizationId') org?: string) { return this.s.result(u, id, b, org); }
  @Put('matches/:id/lineup') lineup(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @ValidatedBody(lineupSchema) b: z.infer<typeof lineupSchema>, @Query('organizationId') org?: string) { return this.s.lineup(u, id, b, org); }
  @Get('match-events') events(@CurrentUser() u: Principal, @Query(new ZodPipe(filterSchema)) q: SportFilter) { return this.s.events(u, q); }
  @Post('match-events') createEvent(@CurrentUser() u: Principal, @ValidatedBody(eventSchema) b: z.infer<typeof eventSchema>, @Query('organizationId') org?: string) { return this.s.createEvent(u, b, org); }
  @Delete('match-events/:id') removeEvent(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) { return this.s.removeEvent(u, id, org); }
  @Post('players/evaluations') evaluate(@CurrentUser() u: Principal, @ValidatedBody(evaluationSchema) b: z.infer<typeof evaluationSchema>, @Query('organizationId') org?: string) { return this.s.evaluate(u, b, org); }
  @Get('players/:id/evaluations') evaluations(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Query('organizationId') org?: string) { return this.s.evaluations(u, id, org); }
}
