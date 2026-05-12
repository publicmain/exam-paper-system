import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Global()
@Module({
  controllers: [AuditController],
  providers: [PrismaService, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
