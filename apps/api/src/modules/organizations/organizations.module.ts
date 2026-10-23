import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
@Global() @Module({ providers: [AccessService, OrganizationsService], controllers: [OrganizationsController], exports: [AccessService] })
export class OrganizationsModule {}
