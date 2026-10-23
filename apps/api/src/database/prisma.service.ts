import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { readEnv } from '../config/env';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const env = readEnv();
    const pool = new Pool({ connectionString: env.DATABASE_URL, max: env.DB_POOL_MAX, connectionTimeoutMillis: 10000, idleTimeoutMillis: 5000 });
    if (process.env.VERCEL === '1') attachDatabasePool(pool);
    super({ adapter: new PrismaPg(pool, { disposeExternalPool: true }) });
  }
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class DatabaseModule {}
