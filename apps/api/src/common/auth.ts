import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
export const Public = () => SetMetadata('public', true);
export interface Principal { id: string; sessionId: string; globalRole: 'USER' | 'ADMIN' }
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): Principal => ctx.switchToHttp().getRequest().user);
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector, @Inject(JwtService) private jwt: JwtService, @Inject(PrismaService) private db: PrismaService) {}
  async canActivate(ctx: ExecutionContext) {
    if (this.reflector.getAllAndOverride('public', [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new UnauthorizedException();
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET, algorithms: ['HS256'], issuer: 'footlab', audience: 'footlab-app' });
      if (payload.type !== 'access') throw new Error();
    } catch { throw new UnauthorizedException('Sesión inválida o expirada'); }
    const session = await this.db.session.findFirst({ where: { id: payload.sid, userId: payload.sub, revokedAt: null, expiresAt: { gt: new Date() } }, include: { user: true } });
    if (!session) throw new UnauthorizedException('Sesión inválida o expirada');
    req.user = { id: session.userId, sessionId: session.id, globalRole: session.user.globalRole } satisfies Principal;
    return true;
  }
}
