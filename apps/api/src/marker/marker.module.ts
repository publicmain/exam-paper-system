import { Module } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MarkerController } from './marker.controller';
import { MarkerService } from './marker.service';

@Module({
  controllers: [MarkerController],
  providers: [PrismaService, MarkerService],
  exports: [MarkerService],
})
export class MarkerModule {}
