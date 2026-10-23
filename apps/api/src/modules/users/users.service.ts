import { Inject, Injectable } from '@nestjs/common';
import { Principal } from '../../common/auth';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private db: PrismaService) {}
  me(u: Principal) { return this.db.user.findUniqueOrThrow({ where: { id: u.id }, select: { id: true, name: true, email: true, globalRole: true, createdAt: true } }); }
  update(u: Principal, name: string) { return this.db.user.update({ where: { id: u.id }, data: { name }, select: { id: true, name: true, email: true } }); }
}
