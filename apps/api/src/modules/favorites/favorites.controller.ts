import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { id } from '@footlab/shared';
import { CurrentUser, Principal } from '../../common/auth';
import { ValidatedBody } from '../../common/http';
import { FavoritesService } from './favorites.service';
const schema = z.object({ playerId: id.optional(), teamId: id.optional() }).strict().refine(b => Boolean(b.playerId) !== Boolean(b.teamId), 'Selecciona un jugador o un equipo');
@ApiTags('favorites') @ApiBearerAuth() @Controller('favorites')
export class FavoritesController {
  constructor(@Inject(FavoritesService) private service: FavoritesService) {}
  @Get() list(@CurrentUser() u: Principal) { return this.service.list(u); }
  @Post() add(@CurrentUser() u: Principal, @ValidatedBody(schema) b: z.infer<typeof schema>) { return this.service.add(u, b); }
  @Delete(':id') remove(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string) { return this.service.remove(u, id); }
}
