import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  AdminParentLinksController,
  ParentPortalController,
} from './parent-portal.controller';
import { ParentAuthGuard } from './parent-auth.guard';
import { ParentPortalService } from './parent-portal.service';

/**
 * F14 — Parent portal module. Wires up the admin CRUD controller and
 * the public read-only portal controller, plus the ParentAuthGuard.
 * AuditService is supplied by the global AuditModule.
 */
@Module({
  controllers: [AdminParentLinksController, ParentPortalController],
  providers: [PrismaService, ParentPortalService, ParentAuthGuard],
  exports: [ParentPortalService],
})
export class ParentPortalModule {}
