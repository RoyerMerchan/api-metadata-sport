import { Controller, Get, Inject, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, Principal } from '../../common/auth';
import { ValidatedBody } from '../../common/http';
import { footballRequest, statsBombRequest } from './adapters';
import { IntegrationsService } from './integrations.service';
@ApiTags('integrations') @ApiBearerAuth() @Controller('integrations')
export class IntegrationsController {
  constructor(@Inject(IntegrationsService) private s: IntegrationsService) {}
  @Get() status() { return this.s.status(); }
  @Post('football-data/sync') football(@CurrentUser() u: Principal, @ValidatedBody(footballRequest) b: z.infer<typeof footballRequest>) { return this.s.football(u, b); }
  @Post('statsbomb/import') statsBomb(@CurrentUser() u: Principal, @ValidatedBody(statsBombRequest) b: z.infer<typeof statsBombRequest>) { return this.s.statsBomb(u, b); }
}
