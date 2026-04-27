import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from '../common/prisma.service';
import { InternalController } from './internal.controller';
import { InternalGuard } from './internal-auth.guard';

@Module({
  controllers: [InternalController],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: InternalGuard },
  ],
})
export class InternalModule {}
