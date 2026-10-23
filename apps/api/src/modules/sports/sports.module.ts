import { Global, Module } from '@nestjs/common';
import { SportsService } from './sports.service';
import { SportsController } from './sports.controller';
@Global() @Module({ providers: [SportsService], controllers: [SportsController], exports: [SportsService] })
export class SportsModule {}
