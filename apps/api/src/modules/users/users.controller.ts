import { Controller, Get, Inject, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { name } from '@footlab/shared';
import { CurrentUser, Principal } from '../../common/auth';
import { ValidatedBody } from '../../common/http';
import { UsersService } from './users.service';
@ApiTags('users') @ApiBearerAuth() @Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private service: UsersService) {}
  @Get('me') me(@CurrentUser() u: Principal) { return this.service.me(u); }
  @Patch('me') update(@CurrentUser() u: Principal, @ValidatedBody(z.object({ name }).strict()) body: { name: string }) { return this.service.update(u, body.name); }
}
