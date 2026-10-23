import { Controller, Delete, Get, Headers, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { id, loginSchema, password, registerSchema } from '@footlab/shared';
import { CurrentUser, Principal, Public } from '../../common/auth';
import { ValidatedBody } from '../../common/http';
import { AuthService } from './auth.service';
@ApiTags('auth') @ApiBearerAuth() @Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  @Public() @Throttle({ default: { limit: 5, ttl: 60000 } }) @Post('register')
  register(@ValidatedBody(registerSchema) body: z.infer<typeof registerSchema>, @Headers('user-agent') ua?: string) { return this.auth.register(body, ua); }
  @Public() @Throttle({ default: { limit: 10, ttl: 60000 } }) @Post('login')
  login(@ValidatedBody(loginSchema) body: z.infer<typeof loginSchema>, @Headers('user-agent') ua?: string) { return this.auth.login(body, ua); }
  @Public() @Post('refresh')
  refresh(@ValidatedBody(z.object({ refreshToken: z.string().min(20).max(4096) }).strict()) body: { refreshToken: string }) { return this.auth.refresh(body.refreshToken); }
  @Post('logout') logout(@CurrentUser() user: Principal) { return this.auth.logout(user); }
  @Get('sessions') sessions(@CurrentUser() user: Principal) { return this.auth.sessions(user); }
  @Get('session') current(@CurrentUser() user: Principal) { return this.auth.current(user); }
  @Post('session/workspace') workspace(@CurrentUser() user: Principal, @ValidatedBody(z.object({ organizationId: id }).strict()) body: { organizationId: string }) { return this.auth.workspace(user, body.organizationId); }
  @Post('sessions/revoke-others') revokeOthers(@CurrentUser() user: Principal) { return this.auth.revokeOthers(user); }
  @Delete('sessions/:id') revoke(@CurrentUser() user: Principal, @Param('id', ParseUUIDPipe) id: string) { return this.auth.revoke(user, id); }
  @Public() @Post('forgot-password') forgot(@ValidatedBody(z.object({ email: z.string().email() }).strict()) body: { email: string }) { return this.auth.forgot(body.email); }
  @Public() @Post('reset-password') reset(@ValidatedBody(z.object({ token: z.string().length(64), password }).strict()) body: { token: string; password: string }) { return this.auth.reset(body.token, body.password); }
}
