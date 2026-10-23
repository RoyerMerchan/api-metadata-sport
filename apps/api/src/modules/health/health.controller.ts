import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/auth';
import { PrismaService } from '../../database/prisma.service';
@ApiTags('health') @Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private db: PrismaService) {}
  @Public() @SkipThrottle() @Get() async health() { try { await this.db.$queryRaw`SELECT 1`; return { status: 'ok' }; } catch { throw new ServiceUnavailableException({ status: 'unavailable' }); } }
}
