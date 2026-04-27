import { Module } from '@nestjs/common';
import { ReferenceController } from './reference.controller';
import { ReferenceService } from './reference.service';
import { PrismaService } from '../common/prisma.service';

@Module({
  controllers: [ReferenceController],
  providers: [ReferenceService, PrismaService],
})
export class ReferenceModule {}
