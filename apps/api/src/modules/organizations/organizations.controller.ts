import { Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { acceptInvitationSchema, ClubRole, invitationSchema, organizationSchema, roles } from '@footlab/shared';
import { CurrentUser, Principal } from '../../common/auth';
import { ValidatedBody } from '../../common/http';
import { OrganizationsService } from './organizations.service';
@ApiTags('organizations') @ApiBearerAuth() @Controller('organizations')
export class OrganizationsController {
  constructor(@Inject(OrganizationsService) private service: OrganizationsService) {}
  @Get() list(@CurrentUser() u: Principal) { return this.service.list(u); }
  @Post() create(@CurrentUser() u: Principal, @ValidatedBody(organizationSchema) b: { name: string }) { return this.service.create(u, b.name); }
  @Post('invitations/accept') accept(@CurrentUser() u: Principal, @ValidatedBody(acceptInvitationSchema) b: { token: string }) { return this.service.accept(u, b.token); }
  @Post(':id/invitations') invite(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @ValidatedBody(invitationSchema) b: z.infer<typeof invitationSchema>) { return this.service.invite(u, id, b.email, b.role); }
  @Get(':id/invitations') invitations(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string) { return this.service.invitations(u, id); }
  @Delete(':id/invitations/:invitationId') revokeInvitation(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Param('invitationId', ParseUUIDPipe) invitationId: string) { return this.service.revokeInvitation(u, id, invitationId); }
  @Delete(':id/members/:userId') removeMember(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string) { return this.service.removeMember(u, id, userId); }
  @Patch(':id') update(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @ValidatedBody(organizationSchema) b: { name: string }) { return this.service.update(u, id, b.name); }
  @Get(':id/members') members(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string) { return this.service.members(u, id); }
  @Post(':id/members') member(@CurrentUser() u: Principal, @Param('id', ParseUUIDPipe) id: string, @ValidatedBody(z.object({ email: z.string().email(), role: z.enum(roles) }).strict()) b: { email: string; role: ClubRole }) { return this.service.member(u, id, b.email, b.role); }
}
