import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AdminRbacController } from './admin-rbac.controller';
import { AdminRbacService } from './admin-rbac.service';

@Module({
  controllers: [AdminRbacController],
  providers: [PrismaService, AdminRbacService],
  exports: [AdminRbacService],
})
export class AdminRbacModule {}
