import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard } from './common/auth';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { SportsModule } from './modules/sports/sports.module';
import { UsersController } from './modules/users/users.controller';
import { UsersService } from './modules/users/users.service';
import { StatisticsController } from './modules/statistics/statistics.controller';
import { StatisticsService } from './modules/statistics/statistics.service';
import { FavoritesController } from './modules/favorites/favorites.controller';
import { FavoritesService } from './modules/favorites/favorites.service';
import { HealthController } from './modules/health/health.controller';
import { IntegrationsModule } from './modules/integrations/integrations.module';
@Module({
  imports: [DatabaseModule, AuthModule, OrganizationsModule, SportsModule, IntegrationsModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
  controllers: [UsersController, StatisticsController, FavoritesController, HealthController], providers: [UsersService, FavoritesService, StatisticsService, { provide: APP_GUARD, useClass: ThrottlerGuard }, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
