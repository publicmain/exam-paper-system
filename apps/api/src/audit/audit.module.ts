import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from './audit.service';

@Global()
@Module({
  providers: [PrismaService, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
