import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, PrismaService, AuditService],
})
export class UsersModule {}
